import { INTERVIEW_VOICES, DEFAULT_INTERVIEW_VOICE_ID } from '../../shared/voices.js'

/** Admin-selectable OpenRouter chat models for interviews + role cards. */
export const OPENROUTER_MODEL_OPTIONS = [
  { id: 'openai/gpt-5.6-luna', label: 'OpenAI GPT-5.6 Luna' },
  { id: 'openai/gpt-4o', label: 'OpenAI GPT-4o' },
  { id: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o Mini' },
  { id: 'openai/gpt-4.1', label: 'OpenAI GPT-4.1' },
  { id: 'openai/gpt-4.1-mini', label: 'OpenAI GPT-4.1 Mini' },
  { id: 'anthropic/claude-sonnet-4', label: 'Anthropic Claude Sonnet 4' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Anthropic Claude 3.5 Sonnet' },
  { id: 'google/gemini-2.5-pro', label: 'Google Gemini 2.5 Pro' },
  { id: 'google/gemini-2.5-flash', label: 'Google Gemini 2.5 Flash' },
]

/** Admin-selectable ElevenLabs TTS models. */
export const ELEVENLABS_MODEL_OPTIONS = [
  { id: 'eleven_multilingual_v2', label: 'Multilingual v2 (quality)' },
  { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5 (faster)' },
  { id: 'eleven_flash_v2_5', label: 'Flash v2.5 (lowest latency)' },
  { id: 'eleven_multilingual_v1', label: 'Multilingual v1' },
  { id: 'eleven_monolingual_v1', label: 'English v1' },
]

export const SETTING_KEYS = {
  OPENROUTER_MODEL: 'openrouter_model',
  ELEVENLABS_MODEL_ID: 'elevenlabs_model_id',
  DEFAULT_VOICE_ID: 'default_elevenlabs_voice_id',
}

export const SETTING_DEFINITIONS = [
  {
    key: SETTING_KEYS.OPENROUTER_MODEL,
    title: 'OpenRouter chat model',
    description:
      'Used for interview turns and role-card generation. Env OPENROUTER_MODEL is the fallback if unset.',
    options: OPENROUTER_MODEL_OPTIONS,
  },
  {
    key: SETTING_KEYS.ELEVENLABS_MODEL_ID,
    title: 'ElevenLabs TTS model',
    description:
      'Neural voice model for read-aloud. Env ELEVENLABS_MODEL_ID is the fallback if unset.',
    options: ELEVENLABS_MODEL_OPTIONS,
  },
  {
    key: SETTING_KEYS.DEFAULT_VOICE_ID,
    title: 'Default narrator voice',
    description:
      'Default voice for users who have not chosen one yet. Users can still override in the interview header.',
    options: INTERVIEW_VOICES.map((v) => ({ id: v.id, label: v.name })),
  },
]

export const DEFAULT_SETTINGS = {
  [SETTING_KEYS.OPENROUTER_MODEL]: 'openai/gpt-5.6-luna',
  [SETTING_KEYS.ELEVENLABS_MODEL_ID]: 'eleven_multilingual_v2',
  [SETTING_KEYS.DEFAULT_VOICE_ID]: DEFAULT_INTERVIEW_VOICE_ID,
}

export function isAllowedSettingValue(key, value) {
  const def = SETTING_DEFINITIONS.find((d) => d.key === key)
  if (!def) return false
  return def.options.some((o) => o.id === value)
}
