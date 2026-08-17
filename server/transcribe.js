import { requireAuthUser } from './auth.js'

const OPENROUTER_STT_URL = 'https://openrouter.ai/api/v1/audio/transcriptions'
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_STT_MODEL = 'openai/whisper-1'

const POLISH_PROMPT = `You clean up speech transcripts for a career reflection interview.
Fix punctuation, capitalization, and sentence boundaries only.
Do NOT change wording, meaning, names, or add content.
Do NOT add quotation marks around the whole answer.
Return ONLY the cleaned transcript text — no preamble.`

function looksUnpunctuated(text) {
  const t = text.trim()
  if (!t) return false
  const hasSentenceEnd = /[.!?…]/.test(t)
  const startsLower = /^[a-z]/.test(t)
  return !hasSentenceEnd || startsLower
}

async function polishTranscript(text, env) {
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey || !text?.trim()) return text

  const model = env.OPENROUTER_POLISH_MODEL || env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'
  const siteUrl = env.VITE_SITE_URL || 'http://localhost:5173'

  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl,
      'X-Title': 'Career Companion',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: POLISH_PROMPT },
        { role: 'user', content: text },
      ],
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.warn('Transcript polish failed:', data)
    return text
  }

  const polished = data?.choices?.[0]?.message?.content?.trim()
  return polished || text
}

/**
 * POST { audioBase64, format?, language? } → { text }
 * Uses OpenRouter Whisper (or OPENROUTER_STT_MODEL), then light punctuation polish when needed.
 */
export async function handleTranscribe({ authorization, audioBase64, format, language, env }) {
  try {
    await requireAuthUser(authorization, env)
  } catch (error) {
    return { status: error.status || 401, body: { error: error.message } }
  }

  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) {
    return { status: 503, body: { error: 'OpenRouter API key not configured' } }
  }

  let data = String(audioBase64 || '').trim()
  if (!data) {
    return { status: 400, body: { error: 'audioBase64 is required' } }
  }

  // Strip data URI prefix if the client sent one
  const dataUriMatch = data.match(/^data:audio\/[\w.+-]+;base64,(.+)$/i)
  if (dataUriMatch) data = dataUriMatch[1]

  const audioFormat = (format || 'webm').replace(/^\./, '').toLowerCase()
  const allowed = new Set(['wav', 'mp3', 'flac', 'm4a', 'ogg', 'webm', 'aac', 'mp4'])
  if (!allowed.has(audioFormat)) {
    return { status: 400, body: { error: `Unsupported audio format: ${audioFormat}` } }
  }

  // Rough size guard (~8MB base64 ≈ 6MB audio)
  if (data.length > 11_000_000) {
    return { status: 400, body: { error: 'Audio too large — try a shorter recording' } }
  }

  const model = env.OPENROUTER_STT_MODEL || DEFAULT_STT_MODEL
  const siteUrl = env.VITE_SITE_URL || 'http://localhost:5173'

  try {
    const response = await fetch(OPENROUTER_STT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': siteUrl,
        'X-Title': 'Career Companion',
      },
      body: JSON.stringify({
        model,
        language: language || 'en',
        temperature: 0,
        input_audio: {
          data,
          format: audioFormat,
        },
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message =
        result?.error?.message || result?.error || `Transcription failed (${response.status})`
      console.error('OpenRouter STT error:', message)
      return {
        status: 502,
        body: { error: typeof message === 'string' ? message : JSON.stringify(message) },
      }
    }

    let text = (result.text || '').trim()
    if (!text) {
      return { status: 422, body: { error: 'No speech detected — try again' } }
    }

    const shouldPolish = env.OPENROUTER_POLISH_TRANSCRIPT !== 'false' && looksUnpunctuated(text)
    if (shouldPolish || env.OPENROUTER_POLISH_TRANSCRIPT === 'always') {
      try {
        text = await polishTranscript(text, env)
      } catch (error) {
        console.warn('Polish skipped:', error.message)
      }
    }

    return {
      status: 200,
      body: {
        text,
        model,
        polished: shouldPolish || env.OPENROUTER_POLISH_TRANSCRIPT === 'always',
      },
    }
  } catch (error) {
    console.error('Transcribe error:', error)
    return { status: 500, body: { error: error.message || 'Transcription failed' } }
  }
}
