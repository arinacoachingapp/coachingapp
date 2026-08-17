import { supabase } from '@/lib/supabase'
import { getCurrentSession, isRegisteredUser } from '@/lib/auth'
import { OPENING, PHASES, TOTAL_QUESTIONS } from './questions'

export async function ensureCareerAuth() {
  if (!supabase) throw new Error('Database not configured')
  const session = await getCurrentSession()
  if (!session || !isRegisteredUser(session.user)) {
    throw new Error('Please sign in to use Career Companion.')
  }
  return session
}

export async function getAccessToken() {
  const session = await ensureCareerAuth()
  return session.access_token
}

async function interviewTurnRequest(body) {
  const token = await getAccessToken()
  const res = await fetch('/api/career/interview-turn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  let data
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    throw new Error(
      res.ok
        ? 'Interview API returned a non-JSON response'
        : `Interview API unavailable (${res.status}).`
    )
  }
  if (!res.ok) throw new Error(data.error || data.detail || 'Interview turn failed')
  return data
}

export async function startInterviewTurn(sessionId) {
  return interviewTurnRequest({ sessionId, action: 'start' })
}

export async function submitInterviewAnswer(sessionId, message) {
  return interviewTurnRequest({ sessionId, action: 'answer', message })
}

export async function confirmInterviewNames(sessionId, names) {
  return interviewTurnRequest({ sessionId, action: 'confirm_names', names })
}

export async function fetchInterviewStatus(sessionId) {
  return interviewTurnRequest({ sessionId, action: 'status' })
}

/** Create a new in-progress interview session. */
export async function createCareerSession() {
  const authSession = await ensureCareerAuth()

  const { data, error } = await supabase
    .from('career_sessions')
    .insert({
      user_id: authSession.user.id,
      status: 'in_progress',
      current_step: 0,
    })
    .select('id, status, current_step, created_at')
    .single()

  if (error) throw error
  return data
}

/** List sessions for the current user (in-progress first, then completed). */
export async function listCareerSessions() {
  await ensureCareerAuth()

  const { data, error } = await supabase
    .from('career_sessions')
    .select(
      'id, status, current_step, role_title, role_card, interview_state, started_at, completed_at, created_at, updated_at'
    )
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/** Fetch a session and all its responses. */
export async function fetchCareerSession(sessionId) {
  await ensureCareerAuth()

  const { data: session, error: sessionError } = await supabase
    .from('career_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessionError) throw sessionError

  const { data: responses, error: responsesError } = await supabase
    .from('career_responses')
    .select('*')
    .eq('session_id', sessionId)
    .order('step_index')

  if (responsesError) throw responsesError

  return { session, responses: responses ?? [] }
}

export async function markSessionGenerating(sessionId) {
  await ensureCareerAuth()
  const { data, error } = await supabase
    .from('career_sessions')
    .update({ status: 'generating' })
    .eq('id', sessionId)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Reset a session to the post-interview screen so the user can retry generation. */
export async function resetSessionAwaitingGeneration(sessionId) {
  await ensureCareerAuth()
  const { data: session } = await supabase
    .from('career_sessions')
    .select('interview_state')
    .eq('id', sessionId)
    .single()

  const interview_state = session?.interview_state
    ? { ...session.interview_state, phase: PHASES.READY_FOR_CARD }
    : session?.interview_state

  const { data, error } = await supabase
    .from('career_sessions')
    .update({ status: 'in_progress', interview_state })
    .eq('id', sessionId)
    .select()
    .single()
  if (error) throw error
  return data
}

export function needsRoleCardGeneration(session) {
  if (session.role_card) return false
  const phase = session.interview_state?.phase
  if (phase === PHASES.READY_FOR_CARD || phase === PHASES.CLOSING) return true
  if (session.status === 'generating' || session.status === 'failed') return true
  // Legacy: fixed questionnaire complete
  if (!session.interview_state && session.current_step >= TOTAL_QUESTIONS + 1) return true
  return false
}

export function sessionInterviewPhase(session) {
  return session?.interview_state?.phase || PHASES.OPENING
}

export function sessionProgressPercent(session) {
  if (session.role_card || session.status === 'completed') return 100
  if (needsRoleCardGeneration(session)) return 100
  const percent = session.interview_state
    ? // progress stored client-side; estimate from completed ids
      Math.min(
        99,
        Math.round(
          ((session.interview_state.completed_question_ids?.length || 0) / TOTAL_QUESTIONS) * 100
        )
      )
    : session.current_step > 0
      ? Math.round((Math.min(session.current_step, TOTAL_QUESTIONS) / TOTAL_QUESTIONS) * 100)
      : 0
  return percent
}

export async function deleteCareerSession(sessionId) {
  await ensureCareerAuth()
  const { error } = await supabase.from('career_sessions').delete().eq('id', sessionId)
  if (error) throw error
}

/** Persist an edited role card (e.g. name/spelling fixes). */
export async function updateRoleCard(sessionId, roleCard) {
  await ensureCareerAuth()
  const { data, error } = await supabase
    .from('career_sessions')
    .update({ role_card: roleCard })
    .eq('id', sessionId)
    .select('id, role_card')
    .single()
  if (error) throw error
  return data
}

export function formatSessionDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function sessionStatusLabel(status, { awaitingRoleCard = false } = {}) {
  if (awaitingRoleCard) return 'Ready for role card'
  switch (status) {
    case 'in_progress':
      return 'In progress'
    case 'generating':
      return 'Generating…'
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Generation failed'
    default:
      return status
  }
}

export const ROLE_CARD_SECTIONS = [
  { key: 'headline', label: 'Headline' },
  { key: 'biggest_insight', label: 'The biggest insight' },
  { key: 'getting_the_role', label: 'Getting the role' },
  { key: 'business_context', label: 'The business' },
  { key: 'mandate', label: 'What you were there to do' },
  { key: 'why_chosen', label: 'Why they chose you' },
  { key: 'saying_yes', label: 'What made you say yes' },
  { key: 'getting_into_the_role', label: 'Finding your feet' },
  { key: 'macro_look', label: 'Highs and lows' },
  { key: 'people', label: 'The people' },
  { key: 'micro_look', label: 'Day to day' },
  { key: 'ending', label: 'Ending' },
  { key: 'extra_thoughts', label: 'Extra thoughts' },
  // Legacy keys (older cards)
  { key: 'expectations', label: 'The expectations' },
  { key: 'manager_and_team', label: 'The manager & the team' },
  { key: 'environment_factor', label: 'The environment factor' },
]

export { OPENING, PHASES, TOTAL_QUESTIONS }
