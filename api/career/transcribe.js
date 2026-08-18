import { handleTranscribe } from '../../server/transcribe.js'

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const result = await handleTranscribe({
      authorization: req.headers.authorization,
      audioBase64: body.audioBase64,
      format: body.format,
      language: body.language,
      env: process.env,
    })
    return res.status(result.status).json(result.body)
  } catch (error) {
    console.error('Transcribe API error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
