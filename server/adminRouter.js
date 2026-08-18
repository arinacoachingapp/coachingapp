import {
  handleAdminAdmins,
  handleAdminMe,
  handleAdminPromptVersion,
  handleAdminPrompts,
  handleAdminSettings,
} from './adminHandlers.js'

/**
 * Resolve /api/admin/... from a Vercel or Node request.
 * Prefer the real URL — Vercel catch-alls often leave req.query.path empty.
 */
export function adminPathnameFromRequest(req) {
  const rawUrl = String(req.url || req.originalUrl || '')
  const urlPath = rawUrl.split('?')[0]

  if (urlPath.includes('/api/admin')) {
    return urlPath
  }

  const q = req.query?.path
  const fromQuery =
    q == null || q === ''
      ? ''
      : []
          .concat(q)
          .flat()
          .filter(Boolean)
          .map((p) => decodeURIComponent(String(p)))
          .join('/')

  if (fromQuery) return `/api/admin/${fromQuery}`

  const extra = urlPath.replace(/^\//, '').replace(/\/$/, '')
  if (extra && extra !== '[...path]') return `/api/admin/${extra}`

  return '/api/admin'
}

export async function routeAdminRequest({ method, pathname, authorization, body, env }) {
  const sub = String(pathname || '')
    .split('?')[0]
    .replace(/^\/api\/admin\/?/, '')
    .replace(/\/$/, '')

  if (sub === 'me' && method === 'GET') {
    return handleAdminMe({ authorization, env })
  }

  if (sub === 'settings') {
    return handleAdminSettings({
      authorization,
      env,
      method,
      body: body || {},
    })
  }

  if (sub === 'admins') {
    return handleAdminAdmins({
      authorization,
      env,
      method,
      body: body || {},
    })
  }

  if (sub.startsWith('admins/')) {
    const email = decodeURIComponent(sub.slice('admins/'.length))
    return handleAdminAdmins({
      authorization,
      env,
      method,
      email,
      body: body || {},
    })
  }

  if (sub === 'prompts') {
    return handleAdminPrompts({
      authorization,
      env,
      method,
      key: null,
      body: body || {},
    })
  }

  if (sub.startsWith('prompts/')) {
    const rest = sub.slice('prompts/'.length)
    const parts = rest.split('/').filter(Boolean)
    const key = decodeURIComponent(parts[0] || '')
    if (parts[1] === 'versions' && parts[2] && method === 'GET') {
      return handleAdminPromptVersion({
        authorization,
        env,
        key,
        version: parts[2],
      })
    }
    return handleAdminPrompts({
      authorization,
      env,
      method,
      key,
      body: body || {},
    })
  }

  return { status: 404, body: { error: 'Not found' } }
}
