import { handleAdminPrompts } from '../../server/adminHandlers.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  try {
    const result = await handleAdminPrompts({
      authorization: req.headers.authorization,
      env: process.env,
      method: req.method,
      key: null,
      body: {},
    })
    return res.status(result.status).json(result.body)
  } catch (error) {
    console.error('Admin prompts error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
