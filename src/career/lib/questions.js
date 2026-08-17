/** Client-facing interview constants (P1 + bank v1.1 conversational flow). */

export const OPENING = {
  key: 'opening',
  type: 'message',
  text:
    "Let's talk about one role you've had — whichever is most on your mind. There is no wrong pick. Talk about it as you would with a trusted friend, not a recruiter. It will take about 25–30 minutes, and afterwards you'll get a summary back in your own words.",
}

export const SECTIONS = [
  { id: 'frame', label: 'Frame' },
  { id: 'arrival', label: 'Arrival' },
  { id: 'macro', label: 'The bigger picture' },
  { id: 'role_system', label: 'People' },
  { id: 'micro', label: 'Day to day' },
  { id: 'exit', label: 'Closing' },
]

/** Approximate question count for legacy UI helpers. */
export const TOTAL_QUESTIONS = 21

export const PHASES = {
  OPENING: 'opening',
  INTERVIEWING: 'interviewing',
  NAME_CONFIRM: 'name_confirm',
  READY_FOR_CARD: 'ready_for_card',
  CLOSING: 'closing',
}

export function sectionLabel(sectionId) {
  return SECTIONS.find((s) => s.id === sectionId)?.label || sectionId || 'Interview'
}
