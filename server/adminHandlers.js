import {
  addAdmin,
  ensurePromptDefaults,
  getPrompt,
  getPromptVersion,
  getUserSupabase,
  isAdminEmail,
  listAdmins,
  listPromptVersions,
  listPrompts,
  removeAdmin,
  requireAdmin,
  requireUser,
  restorePromptVersion,
  savePrompt,
} from './prompts/promptStore.js'
import { listSettings, saveSettings } from './settings/settingsStore.js'

function authFrom(authorization) {
  return authorization?.replace(/^Bearer\s+/i, '') || ''
}

export async function handleAdminMe({ authorization, env }) {
  const token = authFrom(authorization)
  if (!token) return { status: 401, body: { error: 'Authentication required' } }

  try {
    const supabase = getUserSupabase(token, env)
    const user = await requireUser(supabase)
    const isAdmin = await isAdminEmail(supabase, user.email)
    return {
      status: 200,
      body: { email: user.email, isAdmin },
    }
  } catch (error) {
    return { status: error.status || 500, body: { error: error.message } }
  }
}

export async function handleAdminSettings({ authorization, env, method, body }) {
  const token = authFrom(authorization)
  if (!token) return { status: 401, body: { error: 'Authentication required' } }

  try {
    const supabase = getUserSupabase(token, env)
    const user = await requireUser(supabase)
    await requireAdmin(supabase, user)

    if (method === 'GET') {
      const settings = await listSettings(supabase)
      return { status: 200, body: { settings } }
    }

    if (method === 'PUT') {
      const settings = await saveSettings(supabase, {
        settings: body?.settings,
        email: user.email,
      })
      return { status: 200, body: { settings } }
    }

    return { status: 405, body: { error: 'Method not allowed' } }
  } catch (error) {
    console.error('Admin settings error:', error)
    return { status: error.status || 500, body: { error: error.message || 'Settings failed' } }
  }
}

export async function handleAdminPrompts({ authorization, env, method, key, body }) {
  const token = authFrom(authorization)
  if (!token) return { status: 401, body: { error: 'Authentication required' } }

  try {
    const supabase = getUserSupabase(token, env)
    const user = await requireUser(supabase)

    if (method === 'GET' && !key) {
      await requireAdmin(supabase, user)
      let prompts = await listPrompts(supabase)
      if (!prompts.length) {
        await ensurePromptDefaults(supabase, user.email)
        prompts = await listPrompts(supabase)
      }
      return { status: 200, body: { prompts } }
    }

    if (method === 'GET' && key) {
      await requireAdmin(supabase, user)
      const [prompt, versions] = await Promise.all([
        getPrompt(supabase, key),
        listPromptVersions(supabase, key),
      ])
      if (!prompt) return { status: 404, body: { error: 'Prompt not found' } }
      return { status: 200, body: { prompt, versions } }
    }

    if (method === 'PUT' && key) {
      await requireAdmin(supabase, user)
      const saved = await savePrompt(supabase, {
        key,
        content: body?.content ?? '',
        changeNote: body?.changeNote,
        email: user.email,
      })
      const versions = await listPromptVersions(supabase, key)
      return { status: 200, body: { prompt: saved, versions } }
    }

    if (method === 'POST' && key && body?.action === 'restore') {
      await requireAdmin(supabase, user)
      const saved = await restorePromptVersion(supabase, {
        key,
        version: Number(body.version),
        email: user.email,
        changeNote: body.changeNote,
      })
      const versions = await listPromptVersions(supabase, key)
      return { status: 200, body: { prompt: saved, versions } }
    }

    if (method === 'GET' && key && body?.version) {
      await requireAdmin(supabase, user)
      const version = await getPromptVersion(supabase, key, Number(body.version))
      if (!version) return { status: 404, body: { error: 'Version not found' } }
      return { status: 200, body: { version } }
    }

    return { status: 405, body: { error: 'Method not allowed' } }
  } catch (error) {
    console.error('Admin prompts error:', error)
    return { status: error.status || 500, body: { error: error.message || 'Admin prompts failed' } }
  }
}

export async function handleAdminPromptVersion({ authorization, env, key, version }) {
  const token = authFrom(authorization)
  if (!token) return { status: 401, body: { error: 'Authentication required' } }

  try {
    const supabase = getUserSupabase(token, env)
    const user = await requireUser(supabase)
    await requireAdmin(supabase, user)
    const row = await getPromptVersion(supabase, key, Number(version))
    if (!row) return { status: 404, body: { error: 'Version not found' } }
    return { status: 200, body: { version: row } }
  } catch (error) {
    return { status: error.status || 500, body: { error: error.message } }
  }
}

export async function handleAdminAdmins({ authorization, env, method, email, body }) {
  const token = authFrom(authorization)
  if (!token) return { status: 401, body: { error: 'Authentication required' } }

  try {
    const supabase = getUserSupabase(token, env)
    const user = await requireUser(supabase)
    await requireAdmin(supabase, user)

    if (method === 'GET') {
      const admins = await listAdmins(supabase)
      return { status: 200, body: { admins } }
    }

    if (method === 'POST') {
      const created = await addAdmin(supabase, body?.email, user.email)
      return { status: 200, body: { admin: created } }
    }

    if (method === 'DELETE' && email) {
      if (email.toLowerCase() === user.email?.toLowerCase()) {
        return { status: 400, body: { error: 'You cannot remove your own admin access' } }
      }
      await removeAdmin(supabase, email)
      return { status: 200, body: { ok: true } }
    }

    return { status: 405, body: { error: 'Method not allowed' } }
  } catch (error) {
    return { status: error.status || 500, body: { error: error.message } }
  }
}
