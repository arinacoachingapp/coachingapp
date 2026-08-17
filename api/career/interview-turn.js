import { handleInterviewTurn } from '../../server/interviewTurn.js'

export const config = {
  maxDuration: 60,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}

    const result = await handleInterviewTurn({
      authorization: req.headers.authorization,
      sessionId: body.sessionId,
      action: body.action,
      message: body.message,
      names: body.names,
      env: process.env,
    })

    return res.status(result.status).json(result.body)
  } catch (error) {
    console.error('Interview turn error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
