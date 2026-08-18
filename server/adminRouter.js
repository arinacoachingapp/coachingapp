import {
  handleAdminAdmins,
  handleAdminMe,
  handleAdminPromptVersion,
  handleAdminPrompts,
  handleAdminSettings,
} from './adminHandlers.js'

function parseBody(req) {
  if (req.body == null) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return {}
    }
  }
  return req.body
}

function isRealAdminPath(pathname) {
  return (
    pathname === '/api/admin' ||
    /^\/api\/admin\/(me|settings|prompts|admins)(\/|$)/.test(pathname)
  )
}

/**
 * Resolve /api/admin/... from a Vercel or Node request.
 * Prefer the real URL — Vercel catch-alls often leave req.query.path empty.
 */
export function adminPathnameFromRequest(req, mountPath = '/api/admin') {
  const mount = String(mountPath || '/api/admin').replace(/\/$/, '')
  const headerPath = String(
    req.headers?.['x-invoke-path'] || req.headers?.['x-forwarded-uri'] || ''
  ).split('?')[0]
  const rawUrl = String(req.url || req.originalUrl || '')
  const urlPath = rawUrl.split('?')[0]

  if (isRealAdminPath(headerPath)) return headerPath
  if (isRealAdminPath(urlPath)) return urlPath

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

  if (fromQuery) return `${mount}/${fromQuery}`

  const extra = urlPath.replace(/^\//, '').replace(/\/$/, '')
  if (extra && extra !== '[...path]' && extra !== 'api/admin-gateway' && extra !== 'admin-gateway') {
    return `${mount}/${extra}`
  }

  return mount
}

export async function handleVercelAdmin(req, res, mountPath = '/api/admin') {
  try {
    const result = await routeAdminRequest({
      method: req.method,
      pathname: adminPathnameFromRequest(req, mountPath),
      authorization: req.headers.authorization,
      body: parseBody(req),
      env: process.env,
    })
    return res.status(result.status).json(result.body)
  } catch (error) {
    console.error('Admin API error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
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
