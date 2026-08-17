import { createClient } from '@supabase/supabase-js'
import { buildTranscriptForCard } from './interview/interviewEngine.js'
import { CARD_VERSION, versionTriple } from './interview/versions.js'
import { loadRuntimePrompts } from './prompts/promptStore.js'
import { PROMPT_DEFINITIONS } from './prompts/defaults.js'
import { resolveRuntimeConfig } from './settings/settingsStore.js'

const ROLE_CARD_KEYS = [
  'headline',
  'biggest_insight',
  'getting_the_role',
  'business_context',
  'mandate',
  'why_chosen',
  'saying_yes',
  'getting_into_the_role',
  'macro_look',
  'people',
  'micro_look',
  'ending',
  'extra_thoughts',
]

const DEFAULT_MODEL = 'openai/gpt-5.6-luna'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

function getUserSupabase(accessToken, env) {
  const supabaseUrl = env.VITE_SUPABASE_URL
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase not configured')
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

function buildRoleCardPrompt(transcript, interviewState, template) {
  const qaBlock = transcript
    .map((item) => {
      const probes =
        item.probes?.length > 0
          ? `\nProbes used:\n${item.probes.map((p) => `- ${p}`).join('\n')}`
          : ''
      return `${item.question_key}: ${item.question_text}${probes}\nA: ${item.response_text || '(no answer)'}`
    })
    .join('\n\n')

  const meta = interviewState
    ? `Session meta (do not invent beyond transcript):
- role_name: ${interviewState.role_name || 'unknown'}
- tense: ${interviewState.tense || 'past'}
- route: ${interviewState.route || 'unclear'}
- is_managerial: ${interviewState.is_managerial}
- boss_configuration: ${interviewState.boss_configuration}
- names (corrected): ${(interviewState.names || []).join(', ') || 'none'}
- version: interviewer ${interviewState.version?.interviewer || '?'}, bank ${interviewState.version?.bank || '?'}, card ${CARD_VERSION}
`
    : ''

  const fallback = PROMPT_DEFINITIONS.find((d) => d.key === 'role_card_p2')?.content || ''
  const source = template || fallback

  return source.replaceAll('{{META}}', meta).replaceAll('{{TRANSCRIPT}}', qaBlock)
}

function parseRoleCardJson(text) {
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3)
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
  return JSON.parse(cleaned.trim())
}

async function generateWithOpenRouter(prompt, env, modelOverride) {
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured')
  }

  const model = modelOverride || env.OPENROUTER_MODEL || DEFAULT_MODEL
  const siteUrl = env.VITE_SITE_URL || 'http://localhost:5173'

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl,
      'X-Title': 'Career Companion',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      data?.error?.message || data?.error || `OpenRouter request failed (${response.status})`
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
  }

  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('No content generated')
  }

  return typeof content === 'string' ? content : JSON.stringify(content)
}

function isInterviewComplete(interviewState, transcript) {
  if (interviewState?.phase === 'ready_for_card' || interviewState?.phase === 'closing') {
    return true
  }
  // Legacy fixed-question sessions
  if (!interviewState && transcript?.length >= 20) return true
  return transcript?.length >= 15
}

/** Shared handler for Vite middleware and production Express. */
export async function handleGenerateRoleCard({ authorization, sessionId, env }) {
  const accessToken = authorization?.replace(/^Bearer\s+/i, '')
  if (!accessToken) {
    return { status: 401, body: { error: 'Authentication required' } }
  }

  if (!sessionId) {
    return { status: 400, body: { error: 'sessionId is required' } }
  }

  const userSupabase = getUserSupabase(accessToken, env)
  const {
    data: { user },
    error: userError,
  } = await userSupabase.auth.getUser()
  if (userError || !user) {
    return { status: 401, body: { error: 'Invalid session' } }
  }

  const { data: careerSession, error: sessionError } = await userSupabase
    .from('career_sessions')
    .select('id, user_id, status, interview_state, transcript, role_title')
    .eq('id', sessionId)
    .single()

  if (sessionError || !careerSession) {
    return { status: 404, body: { error: 'Session not found' } }
  }

  const interviewState = careerSession.interview_state
  let transcript = careerSession.transcript

  if (interviewState?.turns?.length) {
    transcript = buildTranscriptForCard(interviewState)
  } else if (!transcript?.length) {
    const { data: responses, error: responsesError } = await userSupabase
      .from('career_responses')
      .select('question_key, question_text, response_text, step_index')
      .eq('session_id', sessionId)
      .order('step_index')

    if (responsesError) {
      return { status: 500, body: { error: 'Failed to load responses' } }
    }

    transcript = (responses ?? []).map((r) => ({
      question_key: r.question_key,
      question_number: r.step_index,
      question_text: r.question_text,
      response_text: r.response_text,
    }))
  }

  if (!isInterviewComplete(interviewState, transcript)) {
    return { status: 400, body: { error: 'Interview not complete' } }
  }

  let generatedText
  try {
    let roleCardTemplate = null
    let openrouterModel
    try {
      const runtime = await loadRuntimePrompts(userSupabase)
      roleCardTemplate = runtime.role_card_p2
    } catch (error) {
      console.warn('Prompt load failed for role card, using defaults:', error.message)
    }
    try {
      const config = await resolveRuntimeConfig(userSupabase, env)
      openrouterModel = config.openrouterModel
    } catch {
      openrouterModel = env.OPENROUTER_MODEL || DEFAULT_MODEL
    }
    generatedText = await generateWithOpenRouter(
      buildRoleCardPrompt(transcript, interviewState, roleCardTemplate),
      env,
      openrouterModel
    )
  } catch (error) {
    console.error('OpenRouter generation failed:', error)
    return { status: 500, body: { error: error.message || 'Failed to generate role card' } }
  }

  let roleCard
  try {
    roleCard = parseRoleCardJson(generatedText)
  } catch {
    console.error('Failed to parse OpenRouter response:', generatedText)
    return { status: 500, body: { error: 'Failed to parse generated role card' } }
  }

  for (const key of ROLE_CARD_KEYS) {
    if (typeof roleCard[key] !== 'string') {
      roleCard[key] = roleCard[key] != null ? String(roleCard[key]) : ''
    }
  }

  // Empty ending for current roles
  if (interviewState?.tense === 'present') {
    roleCard.ending = ''
  }

  const roleTitle =
    interviewState?.role_name ||
    transcript.find((t) => t.question_key === 'Q1' || t.question_key === 'q1')?.response_text?.slice(
      0,
      200
    ) ||
    careerSession.role_title ||
    null

  const versions = {
    ...(interviewState?.version || versionTriple()),
    card: CARD_VERSION,
  }

  const { data: updated, error: updateError } = await userSupabase
    .from('career_sessions')
    .update({
      status: 'completed',
      // Legacy check constraint career_sessions_current_step_check allows 0–24
      current_step: 24,
      role_card: roleCard,
      transcript,
      role_title: roleTitle,
      interview_state: interviewState
        ? { ...interviewState, phase: 'closing', version: versions }
        : interviewState,
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select()
    .single()

  if (updateError) {
    console.error('Failed to save role card:', updateError)
    return { status: 500, body: { error: 'Failed to save role card' } }
  }

  return { status: 200, body: { success: true, roleCard, session: updated, version: versions } }
}

export { ROLE_CARD_KEYS }
