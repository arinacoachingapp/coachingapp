import { createClient } from '@supabase/supabase-js'

const ROLE_CARD_KEYS = [
  'headline',
  'biggest_insight',
  'getting_the_role',
  'business_context',
  'expectations',
  'manager_and_team',
  'environment_factor',
  'getting_into_the_role',
  'micro_look',
  'macro_look',
  'extra_thoughts',
  'ending',
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

function buildRoleCardPrompt(transcript) {
  const qaBlock = transcript
    .map(
      (item) =>
        `Q${item.question_number}: ${item.question_text}\nA: ${item.response_text || '(no answer)'}`
    )
    .join('\n\n')

  return `You are helping someone reflect on a past professional role. Your job is to produce a Role Card — a structured summary in the person's OWN words. Do NOT polish into corporate or recruiter language. Keep their authentic voice. Include what drained them as readily as what energised them.

Based on these interview responses, produce a Role Card with exactly these sections:

- headline: one sentence capturing the shape of the role (from Q1–4 answers)
- biggest_insight: one or two lines, in their words (from Q21)
- getting_the_role: one or two lines, in their words (from Q5)
- business_context: one or two sentences (from Q6–7)
- expectations: one sentence on expectations and clarity (from Q8)
- manager_and_team: one or two sentences (from Q9–10)
- environment_factor: one line naming what mattered most (from Q11)
- getting_into_the_role: their account of becoming autonomous (from Q12)
- micro_look: brief account close to their words (from Q13–15)
- macro_look: bigger picture summary close to their words (from Q16–19)
- extra_thoughts: only if Q22 had something specific; otherwise empty string
- ending: brief summary in their words if the role is not current (from Q20); empty string if still in role or unclear

Return ONLY valid JSON with exactly this structure (no markdown, no code blocks):
{
  "headline": "...",
  "biggest_insight": "...",
  "getting_the_role": "...",
  "business_context": "...",
  "expectations": "...",
  "manager_and_team": "...",
  "environment_factor": "...",
  "getting_into_the_role": "...",
  "micro_look": "...",
  "macro_look": "...",
  "extra_thoughts": "...",
  "ending": "..."
}

INTERVIEW TRANSCRIPT:
${qaBlock}`
}

function parseRoleCardJson(text) {
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3)
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
  return JSON.parse(cleaned.trim())
}

async function generateWithOpenRouter(prompt, env) {
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured')
  }

  const model = env.OPENROUTER_MODEL || DEFAULT_MODEL
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
    .select('id, user_id, status')
    .eq('id', sessionId)
    .single()

  if (sessionError || !careerSession) {
    return { status: 404, body: { error: 'Session not found' } }
  }

  const { data: responses, error: responsesError } = await userSupabase
    .from('career_responses')
    .select('question_key, question_text, response_text, step_index')
    .eq('session_id', sessionId)
    .order('step_index')

  if (responsesError) {
    return { status: 500, body: { error: 'Failed to load responses' } }
  }

  const transcript = (responses ?? []).map((r) => ({
    question_key: r.question_key,
    question_number: r.step_index,
    question_text: r.question_text,
    response_text: r.response_text,
  }))

  if (transcript.length < 22) {
    return { status: 400, body: { error: 'Interview not complete' } }
  }

  let generatedText
  try {
    generatedText = await generateWithOpenRouter(buildRoleCardPrompt(transcript), env)
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

  const roleTitle =
    transcript.find((t) => t.question_key === 'q1')?.response_text?.slice(0, 200) || null

  const { data: updated, error: updateError } = await userSupabase
    .from('career_sessions')
    .update({
      status: 'completed',
      current_step: 24,
      role_card: roleCard,
      transcript,
      role_title: roleTitle,
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select()
    .single()

  if (updateError) {
    console.error('Failed to save role card:', updateError)
    return { status: 500, body: { error: 'Failed to save role card' } }
  }

  return { status: 200, body: { success: true, roleCard, session: updated } }
}
