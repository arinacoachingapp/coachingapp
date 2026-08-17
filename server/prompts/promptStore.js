import { createClient } from '@supabase/supabase-js'
import { PROMPT_DEFINITIONS } from './defaults.js'

export function getUserSupabase(accessToken, env) {
  const supabaseUrl = env.VITE_SUPABASE_URL
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase not configured')
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

export async function requireUser(userSupabase) {
  const {
    data: { user },
    error,
  } = await userSupabase.auth.getUser()
  if (error || !user) {
    const err = new Error('Invalid session')
    err.status = 401
    throw err
  }
  return user
}

export async function isAdminEmail(userSupabase, email) {
  if (!email) return false
  const { data, error } = await userSupabase.rpc('is_app_admin')
  if (error) {
    if (/function|does not exist|schema cache/i.test(error.message)) {
      // Fallback if migration not applied
      const { data: row } = await userSupabase
        .from('app_admins')
        .select('email')
        .ilike('email', email)
        .maybeSingle()
      return !!row
    }
    console.warn('is_app_admin rpc failed:', error.message)
    return false
  }
  return !!data
}

export async function requireAdmin(userSupabase, user) {
  const ok = await isAdminEmail(userSupabase, user.email)
  if (!ok) {
    const err = new Error('Admin access required')
    err.status = 403
    throw err
  }
}

function defaultByKey(key) {
  return PROMPT_DEFINITIONS.find((d) => d.key === key) || null
}

/** Ensure all default prompts exist (first admin save or first read can trigger). */
export async function ensurePromptDefaults(userSupabase, actorEmail = 'system') {
  for (const def of PROMPT_DEFINITIONS) {
    const { data: existing } = await userSupabase
      .from('app_prompts')
      .select('key')
      .eq('key', def.key)
      .maybeSingle()

    if (existing) continue

    const { error: insertError } = await userSupabase.from('app_prompts').insert({
      key: def.key,
      title: def.title,
      description: def.description,
      format: def.format,
      content: def.content,
      current_version: 1,
      updated_by_email: actorEmail,
    })

    if (insertError) {
      // Race or RLS — ignore duplicate
      if (!/duplicate|unique/i.test(insertError.message)) {
        console.warn('ensurePromptDefaults insert failed:', def.key, insertError.message)
      }
      continue
    }

    await userSupabase.from('app_prompt_versions').insert({
      prompt_key: def.key,
      version: 1,
      content: def.content,
      change_note: 'Initial seed from application defaults',
      created_by_email: actorEmail,
    })
  }
}

export async function listPrompts(userSupabase) {
  const { data, error } = await userSupabase
    .from('app_prompts')
    .select('key, title, description, format, current_version, updated_at, updated_by_email')
    .order('title')

  if (error) throw error

  if (!data?.length) {
    return PROMPT_DEFINITIONS.map((d) => ({
      key: d.key,
      title: d.title,
      description: d.description,
      format: d.format,
      current_version: 0,
      updated_at: null,
      updated_by_email: null,
      seeded: false,
    }))
  }

  return data
}

export async function getPrompt(userSupabase, key) {
  const { data, error } = await userSupabase
    .from('app_prompts')
    .select('*')
    .eq('key', key)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    const def = defaultByKey(key)
    if (!def) return null
    return {
      key: def.key,
      title: def.title,
      description: def.description,
      format: def.format,
      content: def.content,
      current_version: 0,
      updated_at: null,
      updated_by_email: null,
      from_defaults: true,
    }
  }

  return data
}

export async function getPromptContent(userSupabase, key) {
  const prompt = await getPrompt(userSupabase, key)
  if (prompt?.content) return prompt.content
  return defaultByKey(key)?.content || ''
}

export async function listPromptVersions(userSupabase, key, limit = 50) {
  const { data, error } = await userSupabase
    .from('app_prompt_versions')
    .select('id, prompt_key, version, change_note, created_at, created_by_email')
    .eq('prompt_key', key)
    .order('version', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function getPromptVersion(userSupabase, key, version) {
  const { data, error } = await userSupabase
    .from('app_prompt_versions')
    .select('*')
    .eq('prompt_key', key)
    .eq('version', version)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function savePrompt(userSupabase, { key, content, changeNote, email }) {
  const def = defaultByKey(key)
  const existing = await getPrompt(userSupabase, key)

  if (!existing || existing.from_defaults || existing.current_version === 0) {
    await ensurePromptDefaults(userSupabase, email)
  }

  const current = await getPrompt(userSupabase, key)
  if (!current || current.from_defaults) {
    const err = new Error(
      'Prompt row missing. Run the admin prompts migration and ensure your email is in app_admins.'
    )
    err.status = 500
    throw err
  }

  if (key === 'question_bank') {
    try {
      JSON.parse(content)
    } catch {
      const err = new Error('question_bank must be valid JSON')
      err.status = 400
      throw err
    }
  }

  if (content === current.content) {
    const err = new Error('No changes to save')
    err.status = 400
    throw err
  }

  const nextVersion = (current.current_version || 0) + 1

  const { error: versionError } = await userSupabase.from('app_prompt_versions').insert({
    prompt_key: key,
    version: nextVersion,
    content,
    change_note: (changeNote || '').trim() || 'Updated',
    created_by_email: email,
  })
  if (versionError) throw versionError

  const { data, error } = await userSupabase
    .from('app_prompts')
    .update({
      content,
      current_version: nextVersion,
      updated_at: new Date().toISOString(),
      updated_by_email: email,
      title: current.title || def?.title,
      description: current.description || def?.description,
      format: current.format || def?.format,
    })
    .eq('key', key)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function restorePromptVersion(userSupabase, { key, version, email, changeNote }) {
  const historical = await getPromptVersion(userSupabase, key, version)
  if (!historical) {
    const err = new Error('Version not found')
    err.status = 404
    throw err
  }

  return savePrompt(userSupabase, {
    key,
    content: historical.content,
    changeNote:
      changeNote ||
      `Restored from version ${version}${historical.change_note ? ` (${historical.change_note})` : ''}`,
    email,
  })
}

export async function listAdmins(userSupabase) {
  const { data, error } = await userSupabase
    .from('app_admins')
    .select('email, created_at, created_by')
    .order('email')
  if (error) throw error
  return data || []
}

export async function addAdmin(userSupabase, email, createdBy) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase()
  if (!normalized || !normalized.includes('@')) {
    const err = new Error('Valid email required')
    err.status = 400
    throw err
  }
  const { data, error } = await userSupabase
    .from('app_admins')
    .insert({ email: normalized, created_by: createdBy })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeAdmin(userSupabase, email) {
  const { error } = await userSupabase.from('app_admins').delete().eq('email', email)
  if (error) throw error
}

/** Load runtime prompts for interview / card generation (falls back to file defaults). */
export async function loadRuntimePrompts(userSupabase) {
  const [p1, structured, roleCard, bankRaw] = await Promise.all([
    getPromptContent(userSupabase, 'interviewer_p1'),
    getPromptContent(userSupabase, 'structured_output'),
    getPromptContent(userSupabase, 'role_card_p2'),
    getPromptContent(userSupabase, 'question_bank'),
  ])

  let bank = null
  try {
    bank = JSON.parse(bankRaw)
  } catch {
    bank = null
  }

  return {
    interviewer_p1: p1,
    structured_output: structured,
    role_card_p2: roleCard,
    question_bank: bank,
  }
}
