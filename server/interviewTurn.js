import { createClient } from '@supabase/supabase-js'
import {
  applyInterviewAction,
  applyManagerialFlagAnswer,
  buildModelUserPayload,
  buildTranscriptForCard,
  confirmNames,
  createInitialState,
  progressFromState,
  startInterview,
  validateModelAction,
} from './interview/interviewEngine.js'
import { runWithBank } from './interview/bankContext.js'
import { loadP1Prompt, STRUCTURED_OUTPUT_INSTRUCTIONS } from './interview/p1Prompt.js'
import { loadRuntimePrompts } from './prompts/promptStore.js'
import { resolveRuntimeConfig } from './settings/settingsStore.js'
import { versionTriple } from './interview/versions.js'

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

function parseJsonContent(text) {
  let cleaned = (text || '').trim()
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3)
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
  cleaned = cleaned.trim()
  return JSON.parse(cleaned)
}

async function callOpenRouterJson(messages, env, modelOverride) {
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OpenRouter API key not configured')

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
      messages,
      temperature: 0.5,
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
  if (!content) throw new Error('No content generated')
  return parseJsonContent(typeof content === 'string' ? content : JSON.stringify(content))
}

function ensureState(raw) {
  if (raw && raw.phase && Array.isArray(raw.turns)) {
    return {
      ...createInitialState(),
      ...raw,
      version: raw.version || versionTriple(),
    }
  }
  return createInitialState()
}

function clientPayload(state, extra = {}) {
  return {
    utterance: state.last_utterance,
    phase: state.phase,
    progress: progressFromState(state),
    role_name: state.role_name,
    names: state.names || [],
    version: state.version || versionTriple(),
    current_question_id: state.current_question_id,
    ...extra,
  }
}

async function persistState(userSupabase, sessionId, state, extras = {}) {
  const transcript =
    state.phase === 'ready_for_card' || state.phase === 'closing'
      ? buildTranscriptForCard(state)
      : undefined

  const patch = {
    interview_state: state,
    current_step: state.completed_question_ids?.length || 0,
    ...extras,
  }
  if (state.role_name) patch.role_title = state.role_name
  if (transcript) patch.transcript = transcript
  if (state.phase === 'ready_for_card') {
    patch.status = 'in_progress'
  }

  const { data, error } = await userSupabase
    .from('career_sessions')
    .update(patch)
    .eq('id', sessionId)
    .select('id, status, current_step, role_title, interview_state')
    .single()

  if (error) throw error
  return data
}

async function loadSession(userSupabase, sessionId) {
  const { data, error } = await userSupabase
    .from('career_sessions')
    .select('id, user_id, status, interview_state, role_card, role_title')
    .eq('id', sessionId)
    .single()
  if (error || !data) return null
  return data
}

/**
 * POST body actions:
 * - start: leave opening, ask Q1
 * - answer: { message } user reply during interviewing
 * - confirm_names: { names: string[] }
 * - status: return current utterance/progress
 */
export async function handleInterviewTurn({ authorization, sessionId, action, message, names, env }) {
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

  const careerSession = await loadSession(userSupabase, sessionId)
  if (!careerSession) {
    return { status: 404, body: { error: 'Session not found' } }
  }
  if (careerSession.role_card) {
    return { status: 400, body: { error: 'Session already completed' } }
  }

  let state = ensureState(careerSession.interview_state)

  let runtime
  try {
    runtime = await loadRuntimePrompts(userSupabase)
  } catch (error) {
    console.warn('Prompt load failed, using file defaults:', error.message)
    runtime = {
      interviewer_p1: loadP1Prompt(),
      structured_output: STRUCTURED_OUTPUT_INSTRUCTIONS,
      question_bank: null,
    }
  }

  let openrouterModel
  try {
    const config = await resolveRuntimeConfig(userSupabase, env)
    openrouterModel = config.openrouterModel
  } catch {
    openrouterModel = env.OPENROUTER_MODEL || DEFAULT_MODEL
  }

  return runWithBank(runtime.question_bank, async () => {
  try {
    if (action === 'status') {
      return { status: 200, body: clientPayload(state) }
    }

    if (action === 'start') {
      if (state.phase !== 'opening' && state.current_question_id) {
        return { status: 200, body: clientPayload(state) }
      }
      const result = startInterview(state)
      // Record Q1 as interviewer turn
      result.state.turns = [
        ...result.state.turns,
        {
          id: `t_${Date.now()}_q1`,
          question_id: 'Q1',
          turn_type: 'question',
          role: 'interviewer',
          text: result.utterance,
        },
      ]
      await persistState(userSupabase, sessionId, result.state, {
        started_at: new Date().toISOString(),
        status: 'in_progress',
      })
      return { status: 200, body: clientPayload(result.state) }
    }

    if (action === 'confirm_names') {
      if (state.phase !== 'name_confirm' && state.phase !== 'ready_for_card') {
        return { status: 400, body: { error: 'Not ready for name confirmation' } }
      }
      const result = confirmNames(state, names ?? state.names)
      const transcript = buildTranscriptForCard(result.state)
      await persistState(userSupabase, sessionId, result.state, {
        transcript,
        status: 'in_progress',
      })
      return {
        status: 200,
        body: {
          ...clientPayload(result.state),
          ready_for_card: true,
          transcript,
        },
      }
    }

    if (action !== 'answer') {
      return { status: 400, body: { error: 'Unknown action' } }
    }

    const userText = (message || '').trim()
    if (!userText) {
      return { status: 400, body: { error: 'message is required' } }
    }

    if (state.phase === 'opening') {
      const started = startInterview(state)
      state = started.state
      state.turns = [
        ...state.turns,
        {
          id: `t_${Date.now()}_q1`,
          question_id: 'Q1',
          turn_type: 'question',
          role: 'interviewer',
          text: started.utterance,
        },
      ]
    }

    if (state.phase === 'name_confirm') {
      return {
        status: 400,
        body: { error: 'Use confirm_names to finish the interview', phase: state.phase },
      }
    }

    if (state.phase === 'ready_for_card') {
      return {
        status: 200,
        body: { ...clientPayload(state), ready_for_card: true },
      }
    }

    // Managerial flag can be handled deterministically
    if (state.current_question_id === 'managerial_flag' || state.awaiting_managerial_flag) {
      const result = applyManagerialFlagAnswer(state, userText)
      await persistState(userSupabase, sessionId, result.state)
      return {
        status: 200,
        body: {
          ...clientPayload(result.state),
          names: result.names || result.state.names,
        },
      }
    }

    const system = `${runtime.interviewer_p1 || loadP1Prompt()}\n\n${runtime.structured_output || STRUCTURED_OUTPUT_INSTRUCTIONS}`
    const payload = buildModelUserPayload(state, userText)
    let modelRaw
    try {
      modelRaw = await callOpenRouterJson(
        [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Decide the next interview action based on this payload:\n\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
        env,
        openrouterModel
      )
    } catch (error) {
      console.error('Interview model error:', error)
      // Fallback: advance with bank next question
      modelRaw = {
        action: 'advance',
        utterance: '',
        state_updates: {},
        reason: `fallback after model error: ${error.message}`,
      }
    }

    const decision = validateModelAction(modelRaw, state)
    const result = applyInterviewAction(state, userText, decision)
    await persistState(userSupabase, sessionId, result.state)

    return {
      status: 200,
      body: {
        ...clientPayload(result.state),
        action_taken: decision.action,
        names: result.names || result.state.names,
      },
    }
  } catch (error) {
    console.error('Interview turn error:', error)
    // Likely missing interview_state column
    const msg = error.message || 'Interview turn failed'
    if (/interview_state|column/i.test(msg)) {
      return {
        status: 500,
        body: {
          error:
            'Database missing interview_state column. Run supabase/migrations/20260813_interview_state.sql',
          detail: msg,
        },
      }
    }
    return { status: 500, body: { error: msg } }
  }
  })
}
