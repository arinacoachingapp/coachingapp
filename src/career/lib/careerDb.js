import { supabase } from '@/lib/supabase';
import { getCurrentSession, isRegisteredUser } from '@/lib/auth';
import {
  INTERVIEW_QUESTIONS,
  OPENING,
  CLOSING,
  STEP_CLOSING,
  STEP_DONE,
  STEP_FIRST_QUESTION,
  STEP_OPENING,
  TOTAL_QUESTIONS,
  questionKeyToStep,
} from './questions';

export async function ensureCareerAuth() {
  if (!supabase) throw new Error('Database not configured');
  const session = await getCurrentSession();
  if (!session || !isRegisteredUser(session.user)) {
    throw new Error('Please sign in to use Career Companion.');
  }
  return session;
}

export async function getAccessToken() {
  const session = await ensureCareerAuth();
  return session.access_token;
}

/** Create a new in-progress interview session. */
export async function createCareerSession() {
  const authSession = await ensureCareerAuth();

  const { data, error } = await supabase
    .from('career_sessions')
    .insert({
      user_id: authSession.user.id,
      status: 'in_progress',
      current_step: STEP_OPENING,
    })
    .select('id, status, current_step, created_at')
    .single();

  if (error) throw error;
  return data;
}

/** List sessions for the current user (in-progress first, then completed). */
export async function listCareerSessions() {
  await ensureCareerAuth();

  const { data, error } = await supabase
    .from('career_sessions')
    .select(
      'id, status, current_step, role_title, role_card, started_at, completed_at, created_at, updated_at'
    )
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Fetch a session and all its responses. */
export async function fetchCareerSession(sessionId) {
  await ensureCareerAuth();

  const { data: session, error: sessionError } = await supabase
    .from('career_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError) throw sessionError;

  const { data: responses, error: responsesError } = await supabase
    .from('career_responses')
    .select('*')
    .eq('session_id', sessionId)
    .order('step_index');

  if (responsesError) throw responsesError;

  return { session, responses: responses ?? [] };
}

/** Save one answer immediately (upsert by session + question_key). */
export async function saveCareerResponse({
  sessionId,
  questionKey,
  questionText,
  responseText,
  stepIndex,
}) {
  await ensureCareerAuth();

  const { data, error } = await supabase
    .from('career_responses')
    .upsert(
      {
        session_id: sessionId,
        question_key: questionKey,
        question_text: questionText,
        response_text: responseText.trim(),
        step_index: stepIndex,
      },
      { onConflict: 'session_id,question_key' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Advance session step and optionally set role title from Q1. */
export async function updateCareerSessionStep(sessionId, nextStep, extras = {}) {
  await ensureCareerAuth();

  const patch = {
    current_step: nextStep,
    ...extras,
  };

  if (nextStep === STEP_FIRST_QUESTION && !extras.started_at) {
    patch.started_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('career_sessions')
    .update(patch)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markSessionGenerating(sessionId) {
  return updateCareerSessionStep(sessionId, STEP_CLOSING, { status: 'generating' });
}

/** Reset a session to the post-interview screen so the user can retry generation. */
export async function resetSessionAwaitingGeneration(sessionId) {
  return updateCareerSessionStep(sessionId, STEP_CLOSING, { status: 'in_progress' });
}

export function isInterviewComplete(responses) {
  const answeredKeys = new Set(
    responses.filter((r) => r.response_text?.trim()).map((r) => r.question_key)
  );
  return INTERVIEW_QUESTIONS.every((q) => answeredKeys.has(q.key));
}

/** True when every question is answered but no role card exists yet. */
export function needsRoleCardGeneration(session, responses) {
  if (session.role_card) return false;
  return (
    isInterviewComplete(responses) ||
    session.status === 'generating' ||
    session.status === 'failed' ||
    session.current_step >= STEP_CLOSING
  );
}

export async function saveRoleCard(sessionId, roleCard, transcript) {
  await ensureCareerAuth();

  const roleTitle =
    transcript?.find((r) => r.question_key === 'q1')?.response_text?.slice(0, 200) || null;

  const { data, error } = await supabase
    .from('career_sessions')
    .update({
      status: 'completed',
      current_step: STEP_DONE,
      role_card: roleCard,
      transcript,
      role_title: roleTitle,
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCareerSession(sessionId) {
  await ensureCareerAuth();
  const { error } = await supabase.from('career_sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

/** Compute the step to resume at from saved responses. */
export function computeResumeStep(session, responses) {
  if (session.status === 'completed' && session.role_card) return STEP_DONE;
  if (needsRoleCardGeneration(session, responses)) return STEP_CLOSING;

  const answeredKeys = new Set(
    responses.filter((r) => r.response_text?.trim()).map((r) => r.question_key)
  );

  if (answeredKeys.size === 0) {
    return session.current_step ?? STEP_OPENING;
  }

  for (let i = INTERVIEW_QUESTIONS.length - 1; i >= 0; i--) {
    if (answeredKeys.has(INTERVIEW_QUESTIONS[i].key)) {
      const next = i + 2;
      return next > TOTAL_QUESTIONS ? STEP_CLOSING : next;
    }
  }

  return STEP_FIRST_QUESTION;
}

export function responsesToMap(responses) {
  return Object.fromEntries(responses.map((r) => [r.question_key, r.response_text ?? '']));
}

export function buildTranscript(responses) {
  const map = responsesToMap(responses);
  return INTERVIEW_QUESTIONS.map((q) => ({
    question_key: q.key,
    question_number: q.number,
    question_text: q.text,
    response_text: map[q.key] ?? '',
  }));
}

export function formatSessionDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function sessionStatusLabel(status, { awaitingRoleCard = false } = {}) {
  if (awaitingRoleCard) return 'Ready for role card';
  switch (status) {
    case 'in_progress':
      return 'In progress';
    case 'generating':
      return 'Generating…';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Generation failed';
    default:
      return status;
  }
}

export const ROLE_CARD_SECTIONS = [
  { key: 'headline', label: 'Headline' },
  { key: 'biggest_insight', label: 'The biggest insight' },
  { key: 'getting_the_role', label: 'Getting the role' },
  { key: 'business_context', label: 'The business context' },
  { key: 'expectations', label: 'The expectations' },
  { key: 'manager_and_team', label: 'The manager & the team' },
  { key: 'environment_factor', label: 'The environment factor' },
  { key: 'getting_into_the_role', label: 'Getting into the role' },
  { key: 'micro_look', label: 'Micro-look at the role' },
  { key: 'macro_look', label: 'Macro-look at the role' },
  { key: 'extra_thoughts', label: 'Extra thoughts' },
  { key: 'ending', label: 'Ending' },
];

export { OPENING, CLOSING, INTERVIEW_QUESTIONS, questionKeyToStep };
