import {
  getCoreQuestionIds,
  getExitSequence,
  getMeta,
  getOpeningGuidance,
  getQuestion,
  getQuestionOrder,
  getQuestions,
  getSectionBridges,
  q7Text,
  questionText,
  sectionLabel,
} from './bankContext.js'
import { versionTriple } from './versions.js'

export function createInitialState() {
  return {
    version: versionTriple(),
    phase: 'opening', // opening | interviewing | name_confirm | closing | ready_for_card
    current_question_id: null,
    probes_used: 0,
    probes_on_current: 0,
    role_name: null,
    tense: 'past',
    route: 'unclear',
    is_managerial: null, // true | false | null
    boss_configuration: null, // single | sequential | dual_reporting | none | null
    names: [],
    completed_question_ids: [],
    skipped_question_ids: [],
    turns: [],
    last_utterance: getOpeningGuidance().default_text,
    awaiting_managerial_flag: false,
    pending_next_after_ack: null,
  }
}

export function slimQuestionForModel(question, state) {
  if (!question) return null
  if (question.type === 'section_intro') {
    return {
      id: question.id,
      type: 'section_intro',
      text: question.text,
      section: question.section,
      sufficient_when: question.sufficient_when,
      probe_if: question.probe_if || [],
      probe_examples: question.probe_examples || [],
      max_probes: question.max_probes ?? 0,
      never_probe_for: question.never_probe_for || null,
      note: 'Use the answer to set boss_configuration and is_managerial in state_updates when clear.',
    }
  }

  const text =
    question.id === 'Q7' ? q7Text(state.route) : questionText(question, state.tense)

  return {
    id: question.id,
    section: question.section,
    text,
    effort_ceiling: question.effort_ceiling || null,
    story: !!question.story,
    priority_probe: !!question.priority_probe,
    sufficient_when: question.sufficient_when,
    probe_if: question.probe_if || [],
    probe_examples: question.probe_examples || [],
    max_probes: question.max_probes ?? 0,
    never_probe_for: question.never_probe_for || null,
    distress_gate: !!question.distress_gate,
    family_exception: question.family_exception || null,
    followup: question.followup || null,
    conditional_followup: question.conditional_followup || null,
    denial_probe_examples: question.denial_probe_examples || null,
    dont_know_probe: question.dont_know_probe || null,
    critical_note: question.critical_note || null,
    current_role_rule: question.current_role_rule || null,
    sequential_note: question.sequential_note || null,
  }
}

export function isQuestionApplicable(id, state) {
  const q = getQuestion(id)
  if (!q) return false
  if (q.type === 'section_intro') return true

  if (id === 'Q12') {
    const cfg = state.boss_configuration
    if (cfg === 'dual_reporting') return false
    if (cfg === 'none') return false
    return true
  }
  if (id === 'Q13') {
    return state.boss_configuration === 'dual_reporting'
  }
  if (id === 'Q15' || id === 'Q16') {
    return state.is_managerial === true
  }
  if (id === 'Q19') {
    return state.tense !== 'present'
  }
  return true
}

export function nextQuestionId(state, afterId = state.current_question_id) {
  const startIdx = afterId ? getQuestionOrder().indexOf(afterId) + 1 : 0
  for (let i = startIdx; i < getQuestionOrder().length; i++) {
    const id = getQuestionOrder()[i]
    if (state.completed_question_ids.includes(id)) continue
    if (state.skipped_question_ids.includes(id)) continue
    if (!isQuestionApplicable(id, state)) {
      continue
    }
    return id
  }
  return null
}

export function buildQuestionUtterance(state, questionId) {
  const q = getQuestion(questionId)
  if (!q) return null

  if (q.type === 'section_intro') {
    return q.text
  }

  let text = questionId === 'Q7' ? q7Text(state.route) : questionText(q, state.tense)

  if (questionId === 'Q18' && getSectionBridges().micro) {
    text = `${getSectionBridges().micro} ${text}`
  }

  // Role system intro is its own step; Q12/Q13 follow without repeating the bridge.
  return text
}

export function progressFromState(state) {
  const applicable = getCoreQuestionIds().filter((id) => {
    if (state.skipped_question_ids.includes(id)) return false
    // Treat unknown managerial as still potentially applicable for progress ceiling
    if ((id === 'Q15' || id === 'Q16') && state.is_managerial === false) return false
    if (id === 'Q13' && state.boss_configuration && state.boss_configuration !== 'dual_reporting') {
      return false
    }
    if (id === 'Q12' && state.boss_configuration === 'dual_reporting') return false
    if (id === 'Q12' && state.boss_configuration === 'none') return false
    if (id === 'Q19' && state.tense === 'present') return false
    return true
  })

  const done = applicable.filter((id) => state.completed_question_ids.includes(id)).length
  const total = Math.max(applicable.length, 1)
  const percent =
    state.phase === 'name_confirm' ||
    state.phase === 'closing' ||
    state.phase === 'ready_for_card'
      ? 100
      : Math.min(99, Math.round((done / total) * 100))

  const current = getQuestion(state.current_question_id)
  return {
    percent,
    section: current?.section || null,
    section_label: current ? sectionLabel(current.section) : null,
    question_id: state.current_question_id,
    completed: done,
    total_estimate: total,
    phase: state.phase,
  }
}

export function extractNamesFromText(text, existing = []) {
  if (!text) return existing
  const found = new Set(existing)
  // Capitalized tokens that look like names (simple heuristic; model also returns names_heard)
  const matches = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g) || []
  const stop = new Set([
    'I',
    'The',
    'We',
    'They',
    'My',
    'Our',
    'And',
    'But',
    'So',
    'When',
    'Then',
    'After',
    'Before',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ])
  for (const m of matches) {
    if (!stop.has(m.split(' ')[0]) && m.length > 2) found.add(m)
  }
  return [...found]
}

export function applyStateUpdates(state, updates = {}) {
  const next = { ...state }
  if (updates.role_name) next.role_name = String(updates.role_name).slice(0, 200)
  if (updates.tense === 'past' || updates.tense === 'present') next.tense = updates.tense
  if (updates.route) next.route = updates.route
  if (typeof updates.is_managerial === 'boolean') next.is_managerial = updates.is_managerial
  if (updates.boss_configuration) next.boss_configuration = updates.boss_configuration
  if (Array.isArray(updates.names_heard) && updates.names_heard.length) {
    const set = new Set([...(next.names || []), ...updates.names_heard.map(String)])
    next.names = [...set]
  }
  return next
}

export function markQuestionComplete(state, questionId) {
  const completed = new Set(state.completed_question_ids)
  completed.add(questionId)
  // Skip inapplicable siblings when we learn configuration
  const skipped = new Set(state.skipped_question_ids)
  if (questionId === 'Q12' || state.boss_configuration === 'dual_reporting') {
    if (state.boss_configuration === 'dual_reporting') skipped.add('Q12')
  }
  if (questionId === 'Q13' || (state.boss_configuration && state.boss_configuration !== 'dual_reporting')) {
    if (state.boss_configuration && state.boss_configuration !== 'dual_reporting') skipped.add('Q13')
  }
  if (state.is_managerial === false) {
    skipped.add('Q15')
    skipped.add('Q16')
  }
  if (state.tense === 'present') skipped.add('Q19')

  return {
    ...state,
    completed_question_ids: [...completed],
    skipped_question_ids: [...skipped],
    probes_on_current: 0,
  }
}

export function skipInapplicable(state) {
  const skipped = new Set(state.skipped_question_ids)
  for (const id of getQuestionOrder()) {
    if (!isQuestionApplicable(id, state) && getQuestion(id)?.type !== 'section_intro') {
      skipped.add(id)
    }
  }
  // Always complete intro when we leave it
  return { ...state, skipped_question_ids: [...skipped] }
}

/**
 * Deterministic start: opening → Q1
 */
export function startInterview(state) {
  const next = {
    ...state,
    phase: 'interviewing',
    current_question_id: 'Q1',
    probes_on_current: 0,
  }
  const utterance = buildQuestionUtterance(next, 'Q1')
  next.last_utterance = utterance
  next.turns = [
    ...state.turns,
    {
      id: `t_${Date.now()}`,
      question_id: null,
      turn_type: 'opening',
      role: 'interviewer',
      text: state.last_utterance || getOpeningGuidance().default_text,
    },
  ]
  return { state: next, utterance }
}

export function appendTurn(state, turn) {
  return {
    ...state,
    turns: [...state.turns, { id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ...turn }],
  }
}

export function validateModelAction(raw, state) {
  const budget = getMeta().probe_budget
  const current = getQuestion(state.current_question_id)
  const maxProbes = current?.max_probes ?? 0
  let action = raw?.action || 'advance'
  let utterance = (raw?.utterance || '').trim()
  const updates = raw?.state_updates || {}

  const probesRemaining = budget - (state.probes_used || 0)
  const canProbe =
    action === 'probe' &&
    probesRemaining > 0 &&
    (state.probes_on_current || 0) < maxProbes &&
    !updates.distress_detected &&
    maxProbes > 0

  if (action === 'probe' && !canProbe) {
    action = updates.distress_detected ? 'acknowledge_and_advance' : 'advance'
  }

  if (updates.distress_detected && action === 'probe') {
    action = 'acknowledge_and_advance'
  }

  if (!utterance) {
    if (action === 'ask_managerial_flag') {
      utterance = 'And were you managing a team yourself?'
    } else if (action === 'probe' && current?.probe_examples?.length) {
      utterance = current.probe_examples[0]
    } else {
      action = 'advance'
    }
  }

  return { action, utterance, updates, reason: raw?.reason || '' }
}

/**
 * After model decision, compute next state and possibly replace utterance with bank wording on advance.
 */
export function applyInterviewAction(state, userText, decision) {
  let next = appendTurn(state, {
    question_id: state.current_question_id,
    turn_type: 'answer',
    role: 'user',
    text: userText,
  })

  next = applyStateUpdates(next, decision.updates)
  next.names = extractNamesFromText(userText, next.names)

  // Infer tense from Q2 if model missed it
  if (state.current_question_id === 'Q2' && !decision.updates.tense) {
    const lower = userText.toLowerCase()
    if (/\b(still there|current|present|ongoing|now|to date|today)\b/.test(lower)) {
      next.tense = 'present'
    }
  }

  // Infer managerial from language
  if (next.is_managerial == null) {
    if (/\b(my team|direct reports|i managed|i lead|i led|managing a team)\b/i.test(userText)) {
      next.is_managerial = true
    }
  }

  if (decision.action === 'probe') {
    next.probes_used = (next.probes_used || 0) + 1
    next.probes_on_current = (next.probes_on_current || 0) + 1
    next = appendTurn(next, {
      question_id: state.current_question_id,
      turn_type: 'probe',
      role: 'interviewer',
      text: decision.utterance,
    })
    next.last_utterance = decision.utterance
    return { state: next, utterance: decision.utterance, phase: next.phase }
  }

  if (decision.action === 'ask_managerial_flag') {
    next.awaiting_managerial_flag = true
    next = appendTurn(next, {
      question_id: 'managerial_flag',
      turn_type: 'flag',
      role: 'interviewer',
      text: decision.utterance,
    })
    next.last_utterance = decision.utterance
    return { state: next, utterance: decision.utterance, phase: next.phase }
  }

  // advance / acknowledge_and_advance
  const currentId = state.current_question_id
  if (currentId && currentId !== 'managerial_flag') {
    next = markQuestionComplete(next, currentId)
  }

  // After role-system intro, infer boss_configuration if the model did not set it
  if (currentId === 'role_system_intro' && !next.boss_configuration) {
    const lower = userText.toLowerCase()
    if (/\b(two bosses|reported to both|dual report|matrix)\b/.test(lower)) {
      next.boss_configuration = 'dual_reporting'
    } else if (/\b(no boss|nobody|self-employed|no one|didn't report)\b/.test(lower)) {
      next.boss_configuration = 'none'
    } else if (/\b(first|then|later|several|different managers|changed)\b/.test(lower)) {
      next.boss_configuration = 'sequential'
    } else if (/\b(my boss|manager|reported to|reporting to)\b/.test(lower)) {
      next.boss_configuration = 'single'
    } else {
      next.boss_configuration = 'single'
    }
  }

  next = skipInapplicable(next)

  // After boss questions, if managerial unknown, ask flag before Q15
  const nextId = nextQuestionId(next, currentId)
  if (
    nextId &&
    (nextId === 'Q15' || nextId === 'Q16') &&
    next.is_managerial == null &&
    !next.awaiting_managerial_flag
  ) {
    const flagText = 'And were you managing a team yourself?'
    next.awaiting_managerial_flag = true
    next.current_question_id = 'managerial_flag'
    let utterance = flagText
    if (decision.action === 'acknowledge_and_advance' && decision.utterance) {
      // Keep acknowledgement if it doesn't look like a new bank question
      utterance = decision.utterance.includes('?') ? flagText : `${decision.utterance} ${flagText}`
    }
    next = appendTurn(next, {
      question_id: 'managerial_flag',
      turn_type: 'flag',
      role: 'interviewer',
      text: utterance,
    })
    next.last_utterance = utterance
    return { state: next, utterance, phase: next.phase }
  }

  if (!nextId) {
    next.phase = 'name_confirm'
    next.current_question_id = null
    const utterance = getExitSequence().name_confirmation
    next = appendTurn(next, {
      question_id: null,
      turn_type: 'name_confirm',
      role: 'interviewer',
      text: utterance,
    })
    next.last_utterance = utterance
    return { state: next, utterance, phase: next.phase, names: next.names }
  }

  // Role system intro is answerable (detects boss / team). Micro gets a spoken bridge only.
  const deliverId = nextId

  next.current_question_id = deliverId
  next.probes_on_current = 0
  next.awaiting_managerial_flag = false

  let bankUtterance = buildQuestionUtterance(next, deliverId)

  // For acknowledge_and_advance, prefer short ack + bank question
  let utterance = bankUtterance
  if (decision.action === 'acknowledge_and_advance' && decision.utterance) {
    const ack = decision.utterance.replace(/\?.*$/, '').trim()
    if (ack && ack.length < 120) {
      utterance = `${ack} ${bankUtterance}`
    }
  }

  next = appendTurn(next, {
    question_id: deliverId,
    turn_type: 'question',
    role: 'interviewer',
    text: utterance,
  })
  next.last_utterance = utterance
  return { state: next, utterance, phase: next.phase }
}

/**
 * Handle answer to managerial flag question without LLM if needed.
 */
export function applyManagerialFlagAnswer(state, userText) {
  const lower = userText.toLowerCase()
  const yes = /\b(yes|yeah|yep|i did|i was|i am|managed|managing|team of)\b/.test(lower)
  const no = /\b(no|nope|didn't|did not|wasn't|not really|individual contributor|ic\b)\b/.test(lower)

  let next = appendTurn(state, {
    question_id: 'managerial_flag',
    turn_type: 'answer',
    role: 'user',
    text: userText,
  })

  if (yes && !no) next.is_managerial = true
  else if (no) next.is_managerial = false
  else next.is_managerial = /\bteam\b/.test(lower)

  next.awaiting_managerial_flag = false
  next = skipInapplicable(next)

  const deliverId = nextQuestionId(next, 'Q14')
  if (!deliverId) {
    next.phase = 'name_confirm'
    const utterance = getExitSequence().name_confirmation
    next.last_utterance = utterance
    next = appendTurn(next, {
      question_id: null,
      turn_type: 'name_confirm',
      role: 'interviewer',
      text: utterance,
    })
    return { state: next, utterance, phase: next.phase, names: next.names }
  }

  next.current_question_id = deliverId
  const utterance = buildQuestionUtterance(next, deliverId)
  next = appendTurn(next, {
    question_id: deliverId,
    turn_type: 'question',
    role: 'interviewer',
    text: utterance,
  })
  next.last_utterance = utterance
  return { state: next, utterance, phase: next.phase }
}

export function confirmNames(state, names) {
  const next = {
    ...state,
    names: Array.isArray(names) ? names.filter(Boolean) : state.names,
    phase: 'ready_for_card',
  }
  const utterance = getExitSequence().close
  const withTurns = appendTurn(next, {
    question_id: null,
    turn_type: 'close',
    role: 'interviewer',
    text: utterance,
  })
  withTurns.last_utterance = utterance
  return { state: withTurns, utterance, phase: withTurns.phase }
}

export function buildTranscriptForCard(state) {
  const byQuestion = new Map()

  for (const turn of state.turns || []) {
    if (!turn.question_id || turn.question_id === 'managerial_flag') continue
    if (turn.role !== 'user' && turn.turn_type !== 'question' && turn.turn_type !== 'probe') {
      continue
    }
    if (!byQuestion.has(turn.question_id)) {
      byQuestion.set(turn.question_id, {
        question_id: turn.question_id,
        question_text: '',
        answers: [],
        probes: [],
      })
    }
    const entry = byQuestion.get(turn.question_id)
    if (turn.role === 'interviewer' && (turn.turn_type === 'question' || turn.turn_type === 'probe')) {
      if (turn.turn_type === 'question' && !entry.question_text) entry.question_text = turn.text
      if (turn.turn_type === 'probe') entry.probes.push(turn.text)
    }
    if (turn.role === 'user') {
      entry.answers.push(turn.text)
    }
  }

  // Ensure question text from bank if missing
  const items = []
  let n = 0
  for (const id of getQuestionOrder()) {
    if (!byQuestion.has(id)) continue
    if (getQuestion(id)?.type === 'section_intro') continue
    const entry = byQuestion.get(id)
    n += 1
    const q = getQuestion(id)
    items.push({
      question_key: id,
      question_number: n,
      question_text: entry.question_text || questionText(q, state.tense),
      response_text: entry.answers.join('\n\n'),
      probes: entry.probes,
    })
  }
  return items
}

export function turnsForCurrentQuestion(state) {
  const id = state.current_question_id
  if (!id) return []
  return (state.turns || []).filter((t) => t.question_id === id)
}

export function buildModelUserPayload(state, userText) {
  const current = getQuestion(state.current_question_id)
  const upcoming = nextQuestionId(state, state.current_question_id)
  const upcomingQ = upcoming ? getQuestion(upcoming) : null

  return {
    running_state: {
      role_name: state.role_name,
      tense: state.tense,
      route: state.route,
      is_managerial: state.is_managerial,
      boss_configuration: state.boss_configuration,
      names: state.names,
      probes_used: state.probes_used,
      probes_on_current: state.probes_on_current,
      probe_budget: getMeta().probe_budget,
      completed_question_ids: state.completed_question_ids,
    },
    current_question: slimQuestionForModel(current, state),
    next_question_preview: upcomingQ
      ? {
          id: upcomingQ.id,
          text:
            upcomingQ.id === 'Q7'
              ? q7Text(state.route)
              : questionText(upcomingQ, state.tense),
          section: upcomingQ.section,
        }
      : null,
    turns_on_current_question: turnsForCurrentQuestion(state).map((t) => ({
      role: t.role,
      turn_type: t.turn_type,
      text: t.text,
    })),
    latest_answer: userText,
  }
}

export { getQuestions as QUESTIONS, getOpeningGuidance as OPENING_GUIDANCE, getExitSequence as EXIT_SEQUENCE, getMeta as META }
