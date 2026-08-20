import { getAccessToken } from '@/career/lib/careerDb'
import { supabase } from '@/lib/supabase'
import {
  DEFAULT_SETTINGS,
  SETTING_DEFINITIONS,
  isAllowedSettingValue,
} from '../../server/settings/catalog.js'

function requireClient() {
  if (!supabase) throw new Error('Database not configured')
  return supabase
}

async function adminFetch(path, options = {}) {
  const token = await getAccessToken()
  const res = await fetch(`/api/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
  const raw = await res.text()
  let data
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    throw new Error(res.ok ? 'Invalid JSON from admin API' : `Admin API error (${res.status})`)
  }
  if (!res.ok) throw new Error(data.error || `Admin API error (${res.status})`)
  return data
}

/** Reads go straight to Supabase (no Vercel cold start). Writes that need versioning still use the API. */

export async function listAdminPrompts() {
  const db = requireClient()
  const { data, error } = await db
    .from('app_prompts')
    .select('key, title, description, format, current_version, updated_at, updated_by_email')
    .order('title')
  if (error) throw error

  // Empty DB: one-time seed via API (cold once), then re-read.
  if (!data?.length) {
    await adminFetch('/prompts')
    const retry = await db
      .from('app_prompts')
      .select('key, title, description, format, current_version, updated_at, updated_by_email')
      .order('title')
    if (retry.error) throw retry.error
    return { prompts: retry.data || [] }
  }

  return { prompts: data }
}

export async function getAdminPrompt(key) {
  const db = requireClient()
  const [promptRes, versionsRes] = await Promise.all([
    db.from('app_prompts').select('*').eq('key', key).maybeSingle(),
    db
      .from('app_prompt_versions')
      .select('id, prompt_key, version, change_note, created_at, created_by_email')
      .eq('prompt_key', key)
      .order('version', { ascending: false })
      .limit(50),
  ])
  if (promptRes.error) throw promptRes.error
  if (versionsRes.error) throw versionsRes.error
  if (!promptRes.data) throw new Error('Prompt not found')
  return { prompt: promptRes.data, versions: versionsRes.data || [] }
}

export async function saveAdminPrompt(key, { content, changeNote }) {
  return adminFetch(`/prompts/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ content, changeNote }),
  })
}

export async function restoreAdminPrompt(key, version, changeNote) {
  return adminFetch(`/prompts/${encodeURIComponent(key)}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'restore', version, changeNote }),
  })
}

export async function getAdminPromptVersion(key, version) {
  const db = requireClient()
  const { data, error } = await db
    .from('app_prompt_versions')
    .select('*')
    .eq('prompt_key', key)
    .eq('version', Number(version))
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Version not found')
  return { version: data }
}

export async function listAdminEmails() {
  const db = requireClient()
  const { data, error } = await db
    .from('app_admins')
    .select('email, created_at, created_by')
    .order('email')
  if (error) throw error
  return { admins: data || [] }
}

export async function addAdminEmail(email) {
  const db = requireClient()
  const normalized = String(email || '')
    .trim()
    .toLowerCase()
  if (!normalized || !normalized.includes('@')) {
    throw new Error('Valid email required')
  }

  const {
    data: { user },
  } = await db.auth.getUser()
  const { data, error } = await db
    .from('app_admins')
    .insert({ email: normalized, created_by: user?.email || null })
    .select()
    .single()
  if (error) throw error
  return { admin: data }
}

export async function removeAdminEmail(email) {
  const db = requireClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (email.toLowerCase() === user?.email?.toLowerCase()) {
    throw new Error('You cannot remove your own admin access')
  }
  const { error } = await db.from('app_admins').delete().eq('email', email)
  if (error) throw error
  return { ok: true }
}

function mergeSettingsRows(rows) {
  const byKey = Object.fromEntries((rows || []).map((row) => [row.key, row]))
  return SETTING_DEFINITIONS.map((def) => {
    const row = byKey[def.key]
    return {
      key: def.key,
      title: def.title,
      description: def.description,
      options: def.options,
      value: row?.value ?? DEFAULT_SETTINGS[def.key],
      updated_at: row?.updated_at ?? null,
      updated_by_email: row?.updated_by_email ?? null,
      from_defaults: !row,
    }
  })
}

export async function fetchAdminSettings() {
  const db = requireClient()
  const { data, error } = await db.from('app_settings').select('*').order('key')
  if (error) {
    if (/relation|does not exist/i.test(error.message)) {
      return { settings: mergeSettingsRows([]) }
    }
    throw error
  }
  return { settings: mergeSettingsRows(data) }
}

export async function saveAdminSettings(settings) {
  const db = requireClient()
  if (!settings || typeof settings !== 'object') {
    throw new Error('settings object required')
  }

  const {
    data: { user },
  } = await db.auth.getUser()
  const updates = []
  for (const def of SETTING_DEFINITIONS) {
    if (!(def.key in settings)) continue
    const value = String(settings[def.key] || '').trim()
    if (!isAllowedSettingValue(def.key, value)) {
      throw new Error(`Invalid value for ${def.key}`)
    }
    updates.push({
      key: def.key,
      value,
      updated_at: new Date().toISOString(),
      updated_by_email: user?.email || null,
    })
  }
  if (!updates.length) throw new Error('No valid settings to save')

  const { error } = await db.from('app_settings').upsert(updates, { onConflict: 'key' })
  if (error) throw error
  return fetchAdminSettings()
}

/** Authenticated non-admin users: default narrator voice, etc. */
export async function fetchCareerSettings() {
  const db = requireClient()
  const { data, error } = await db
    .from('app_settings')
    .select('key, value')
    .eq('key', 'default_elevenlabs_voice_id')
    .maybeSingle()
  if (error && !/relation|does not exist/i.test(error.message)) throw error
  return {
    defaultVoiceId: data?.value || DEFAULT_SETTINGS.default_elevenlabs_voice_id,
  }
}
