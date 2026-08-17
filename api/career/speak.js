import { handleSpeak } from '../../server/speak.js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const result = await handleSpeak({
      authorization: req.headers.authorization,
      text: body.text,
      voiceId: body.voiceId,
      env: process.env,
    })

    if (result.binary) {
      res.statusCode = result.status
      res.setHeader('Content-Type', result.contentType)
      res.setHeader('Cache-Control', 'no-store')
      return res.end(result.buffer)
    }

    return res.status(result.status).json(result.body)
  } catch (error) {
    console.error('Speak API error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
