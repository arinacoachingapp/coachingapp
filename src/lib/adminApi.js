import { getAccessToken } from '@/career/lib/careerDb'

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

export async function fetchAdminMe() {
  return adminFetch('/me')
}

export async function listAdminPrompts() {
  return adminFetch('/prompts')
}

export async function getAdminPrompt(key) {
  return adminFetch(`/prompts/${encodeURIComponent(key)}`)
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
  return adminFetch(`/prompts/${encodeURIComponent(key)}/versions/${version}`)
}

export async function listAdminEmails() {
  return adminFetch('/admins')
}

export async function addAdminEmail(email) {
  return adminFetch('/admins', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function removeAdminEmail(email) {
  return adminFetch(`/admins/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  })
}

export async function fetchAdminSettings() {
  return adminFetch('/settings')
}

export async function saveAdminSettings(settings) {
  return adminFetch('/settings', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  })
}

/** Authenticated non-admin users: default narrator voice, etc. */
export async function fetchCareerSettings() {
  const token = await getAccessToken()
  const res = await fetch('/api/career/settings', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const raw = await res.text()
  let data
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    throw new Error(res.ok ? 'Invalid JSON from settings API' : `Settings API error (${res.status})`)
  }
  if (!res.ok) throw new Error(data.error || `Settings API error (${res.status})`)
  return data
}
