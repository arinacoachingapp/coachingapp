import { AsyncLocalStorage } from 'node:async_hooks'
import * as defaults from './questionBank.runtime.js'

const storage = new AsyncLocalStorage()

function active() {
  return storage.getStore() || defaults
}

/** Run interview logic with a DB-loaded (or default) question bank for this request. */
export function runWithBank(bank, fn) {
  const resolved = normalizeBank(bank)
  return storage.run(resolved, fn)
}

export function normalizeBank(bank) {
  if (!bank || typeof bank !== 'object') return defaults
  return {
    META: bank.META || defaults.META,
    OPENING_GUIDANCE: bank.OPENING_GUIDANCE || defaults.OPENING_GUIDANCE,
    SECTION_BRIDGES: bank.SECTION_BRIDGES || defaults.SECTION_BRIDGES,
    EXIT_SEQUENCE: bank.EXIT_SEQUENCE || defaults.EXIT_SEQUENCE,
    QUESTION_ORDER: bank.QUESTION_ORDER || defaults.QUESTION_ORDER,
    QUESTIONS: bank.QUESTIONS || defaults.QUESTIONS,
    CORE_QUESTION_IDS:
      bank.CORE_QUESTION_IDS ||
      (bank.QUESTION_ORDER || defaults.QUESTION_ORDER).filter((id) => !String(id).includes('intro')),
  }
}

export function getMeta() {
  return active().META
}

export function getOpeningGuidance() {
  return active().OPENING_GUIDANCE
}

export function getSectionBridges() {
  return active().SECTION_BRIDGES
}

export function getExitSequence() {
  return active().EXIT_SEQUENCE
}

export function getQuestionOrder() {
  return active().QUESTION_ORDER
}

export function getQuestions() {
  return active().QUESTIONS
}

export function getCoreQuestionIds() {
  return active().CORE_QUESTION_IDS
}

export function getQuestion(id) {
  return active().QUESTIONS?.[id] || null
}

export function questionText(question, tense = 'past') {
  if (!question) return ''
  if (tense === 'present' && question.text_present) return question.text_present
  return question.text
}

export function q7Text(route) {
  const q = getQuestion('Q7')
  if (!q) return defaults.q7Text(route)
  return q.wording_by_route?.[route] || q.wording_by_route?.unclear || q.text
}

export function sectionLabel(section) {
  return defaults.sectionLabel(section)
}
