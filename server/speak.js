import { requireAuthUser } from './auth.js'
import { resolveInterviewVoiceId } from '../shared/voices.js'
import { getSettingsMap } from './settings/settingsStore.js'

const FALLBACK_MODEL_ID = 'eleven_multilingual_v2'

function trimEnv(value) {
  return String(value || '').trim()
}

/**
 * POST { text, voiceId? } → { audioBase64, contentType }
 * JSON (not raw MP3) so Vercel serverless cannot mangle the audio body.
 */
export async function handleSpeak({ authorization, text, voiceId, env }) {
  let supabase
  try {
    ;({ supabase } = await requireAuthUser(authorization, env))
  } catch (error) {
    return { status: error.status || 401, body: { error: error.message } }
  }

  const apiKey = trimEnv(env.ELEVENLABS_API_KEY)
  if (!apiKey) {
    return {
      status: 503,
      body: { error: 'ElevenLabs not configured' },
    }
  }

  const trimmed = String(text || '').trim()
  if (!trimmed) {
    return { status: 400, body: { error: 'text is required' } }
  }
  if (trimmed.length > 5000) {
    return { status: 400, body: { error: 'text too long (max 5000 characters)' } }
  }

  // Prefer client voiceId immediately; only hit app_settings for model / default voice.
  let adminDefaultVoiceId = null
  let modelId = trimEnv(env.ELEVENLABS_MODEL_ID) || FALLBACK_MODEL_ID
  try {
    const settings = await getSettingsMap(supabase)
    adminDefaultVoiceId = settings.default_elevenlabs_voice_id
    if (settings.elevenlabs_model_id) {
      modelId = settings.elevenlabs_model_id
    }
  } catch (error) {
    console.warn('Speak settings lookup failed, using env defaults:', error.message)
  }

  const resolvedVoiceId = resolveInterviewVoiceId(
    voiceId,
    adminDefaultVoiceId,
    trimEnv(env.ELEVENLABS_VOICE_ID)
  )

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: trimmed,
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
        },
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error('ElevenLabs error:', response.status, errText, {
        voiceId: resolvedVoiceId,
        modelId,
      })
      return {
        status: 502,
        body: {
          error: 'Voice generation failed',
          detail: errText.slice(0, 400) || `ElevenLabs HTTP ${response.status}`,
          voiceId: resolvedVoiceId,
          modelId,
        },
      }
    }

    const arrayBuffer = await response.arrayBuffer()
    return {
      status: 200,
      body: {
        audioBase64: Buffer.from(arrayBuffer).toString('base64'),
        contentType: 'audio/mpeg',
      },
    }
  } catch (error) {
    console.error('Speak error:', error)
    return {
      status: 500,
      body: { error: error.message || 'Voice generation failed' },
    }
  }
}
