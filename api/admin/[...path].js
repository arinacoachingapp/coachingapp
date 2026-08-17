import {
  handleAdminAdmins,
  handleAdminMe,
  handleAdminPromptVersion,
  handleAdminPrompts,
  handleAdminSettings,
} from '../../server/adminHandlers.js'

export const config = { maxDuration: 30 }

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

export default async function handler(req, res) {
  try {
    const parts = []
      .concat(req.query.path || [])
      .flat()
      .filter(Boolean)
      .map((p) => decodeURIComponent(String(p)))

    const head = parts[0] || ''

    if (head === 'me' && req.method === 'GET') {
      const result = await handleAdminMe({
        authorization: req.headers.authorization,
        env: process.env,
      })
      return res.status(result.status).json(result.body)
    }

    if (head === 'settings') {
      const result = await handleAdminSettings({
        authorization: req.headers.authorization,
        env: process.env,
        method: req.method,
        body: parseBody(req),
      })
      return res.status(result.status).json(result.body)
    }

    if (head === 'admins') {
      if (parts[1] && req.method === 'DELETE') {
        const result = await handleAdminAdmins({
          authorization: req.headers.authorization,
          env: process.env,
          method: 'DELETE',
          email: parts.slice(1).join('/'),
        })
        return res.status(result.status).json(result.body)
      }
      const result = await handleAdminAdmins({
        authorization: req.headers.authorization,
        env: process.env,
        method: req.method,
        body: parseBody(req),
      })
      return res.status(result.status).json(result.body)
    }

    if (head === 'prompts') {
      const key = parts[1] || null
      if (key && parts[2] === 'versions' && parts[3] && req.method === 'GET') {
        const result = await handleAdminPromptVersion({
          authorization: req.headers.authorization,
          env: process.env,
          key,
          version: parts[3],
        })
        return res.status(result.status).json(result.body)
      }
      const result = await handleAdminPrompts({
        authorization: req.headers.authorization,
        env: process.env,
        method: req.method,
        key,
        body: parseBody(req),
      })
      return res.status(result.status).json(result.body)
    }

    return res.status(404).json({ error: 'Not found' })
  } catch (error) {
    console.error('Admin API error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
