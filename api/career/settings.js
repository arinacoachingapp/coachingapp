import { handleCareerSettings } from '../../server/careerSettings.js'

export const config = { maxDuration: 15 }

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await handleCareerSettings({
      authorization: req.headers.authorization,
      env: process.env,
    })
    return res.status(result.status).json(result.body)
  } catch (error) {
    console.error('Career settings error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
