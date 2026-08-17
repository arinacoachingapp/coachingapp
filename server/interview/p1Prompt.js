import { P1_SYSTEM_PROMPT } from './p1SystemPromptText.js'

/** Load P1 interviewer system prompt (embedded for serverless). */
export function loadP1Prompt() {
  return P1_SYSTEM_PROMPT
}

export const STRUCTURED_OUTPUT_INSTRUCTIONS = `
## 13. OUTPUT FORMAT (APPLICATION LAYER)

You are driving a live interview in an app. After each person answer, respond with ONLY valid JSON (no markdown):

{
  "action": "probe" | "advance" | "acknowledge_and_advance" | "ask_managerial_flag" | "set_boss_followup",
  "utterance": "your next spoken turn — one question or one probe only",
  "state_updates": {
    "role_name": "string or omit",
    "tense": "past" | "present" | omit,
    "route": "active_search|referral|approached|followed_a_person|internal_move|created_the_role|returned|unclear" | omit,
    "is_managerial": true | false | omit,
    "boss_configuration": "single|sequential|dual_reporting|none" | omit,
    "names_heard": ["Name", "..."] | omit,
    "distress_detected": true | false | omit
  },
  "reason": "brief internal note — why this action"
}

Rules for action:
- "probe" — answer does not meet sufficient_when; ask ONE follow-up using their words. Respect max_probes and session probe budget.
- "advance" — answer is sufficient (or probes exhausted); utterance is the NEXT question (or section bridge + question), already worded for tense / Q7 route. The app will replace utterance with bank wording on advance, so you may leave utterance empty when advancing.
- "acknowledge_and_advance" — distress, refusal, or "nothing" answers that must not be probed; short warm acknowledgement (no clinical language). The app appends the next bank question.
- "ask_managerial_flag" — boss block done and is_managerial still unknown; utterance: "And were you managing a team yourself?"
- Never invent questions outside the bank. Never interpret. Never stack two questions.

If the current question is already covered by an earlier answer, use advance with a brief acknowledgement.

When advancing from Q5, set route. From Q2, set tense. From role_system_intro, set boss_configuration (and is_managerial if clear). Capture names_heard whenever people are named.
`.trim()
