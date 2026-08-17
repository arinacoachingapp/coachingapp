/** Allowed ElevenLabs voices for Career Companion (user-selectable). */
export const INTERVIEW_VOICES = [
  { id: 'kdmDKE6EkgrWrrykO9Qt', name: 'Alexandra' },
  { id: 'gPPH6SLdL8XSX6GNJ40G', name: 'Brian' },
  { id: 'UgBBYS2sOqTuMpoF3BR0', name: 'Mark' },
  { id: '56AoDkrOh6qfVPDXZ7Pt', name: 'Cassidy' },
  { id: '0G7xjh2pNSLRvJSpklE4', name: 'Lauren' },
  { id: 'RHRP17LnQ9rtwcwNw6Cm', name: 'Ben' },
]

export const DEFAULT_INTERVIEW_VOICE_ID = INTERVIEW_VOICES[0].id

const ALLOWED = new Set(INTERVIEW_VOICES.map((v) => v.id))

export function isAllowedVoiceId(voiceId) {
  return typeof voiceId === 'string' && ALLOWED.has(voiceId)
}

/**
 * Resolve voice for TTS.
 * Priority: valid user selection → admin default → env ELEVENLABS_VOICE_ID → Alexandra.
 */
export function resolveInterviewVoiceId(requested, adminDefaultVoiceId, envVoiceId) {
  if (isAllowedVoiceId(requested)) return requested
  if (isAllowedVoiceId(adminDefaultVoiceId)) return adminDefaultVoiceId
  if (isAllowedVoiceId(envVoiceId)) return envVoiceId
  return DEFAULT_INTERVIEW_VOICE_ID
}

export const VOICE_STORAGE_KEY = 'careerCompanion.voiceId'
