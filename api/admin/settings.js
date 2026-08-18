import { handleAdminSettings } from '../../server/adminHandlers.js'

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
    const result = await handleAdminSettings({
      authorization: req.headers.authorization,
      env: process.env,
      method: req.method,
      body: parseBody(req),
    })
    return res.status(result.status).json(result.body)
  } catch (error) {
    console.error('Admin settings error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
