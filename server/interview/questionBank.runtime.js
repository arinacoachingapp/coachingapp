/**
 * Slim runtime question bank derived from Professional_Role_Interview_Prompt_v1.1.yaml.
 * Design rationale stripped — only what the interviewer model and engine need.
 */

export const META = {
  interview_name: 'Professional Role',
  session_length: '25-30 minutes',
  probe_budget: 10,
  sections: ['frame', 'arrival', 'macro', 'role_system', 'micro', 'exit'],
}

export const OPENING_GUIDANCE = {
  cover: [
    'one role of their choosing',
    'talk about it as they would with a trusted friend, not a recruiter',
    'about 25–30 minutes',
    'they will get a summary back in their own words afterwards',
  ],
  default_text:
    "Let's talk about one role you've had — whichever is most on your mind. There is no wrong pick. Talk about it as you would with a trusted friend, not a recruiter. It will take about 25–30 minutes, and afterwards you'll get a summary back in your own words.",
}

export const SECTION_BRIDGES = {
  role_system: "Now I'd like to talk about the people you worked with in that role.",
  micro: "We've covered the big picture and the people — now the ordinary days.",
}

export const EXIT_SEQUENCE = {
  name_confirmation:
    "Before I put this together — I'd like to make sure I've got the names right. Would you like to spell them, or type them in?",
  close:
    "Thank you. I'm putting your Role Card together now — it'll be ready in a moment.",
}

/** Ordered question ids for the default path (conditionals may skip some). */
export const QUESTION_ORDER = [
  'Q1',
  'Q2',
  'Q3',
  'Q4',
  'Q5',
  'Q6',
  'Q7',
  'Q8',
  'Q9',
  'Q10',
  'Q11',
  'role_system_intro',
  'Q12',
  'Q13',
  'Q14',
  'Q15',
  'Q16',
  'Q17',
  'Q18',
  'Q19',
  'Q20',
  'Q21',
]

export const QUESTIONS = {
  Q1: {
    id: 'Q1',
    section: 'frame',
    text: 'So — which role are we talking about, and what was it called?',
    effort_ceiling: 'low',
    story: false,
    sufficient_when:
      'One role is identifiable and the tool can refer back to it.',
    probe_if: [
      'They name only an employer or a period, with no role.',
      'They name two or more roles, or describe a progression as one role.',
      'They ask which role they should pick.',
    ],
    probe_examples: [
      'And what were you doing there?',
      "Let's take one of those — which feels most worth unpacking?",
      "Whichever one is most on your mind. There's no wrong pick.",
    ],
    max_probes: 1,
    never_probe_for:
      'Exact title wording, seniority level, or the gap between title and reality.',
    critical_note:
      'On which role to pick: refuse selection criteria warmly. Let them choose.',
  },

  Q2: {
    id: 'Q2',
    section: 'frame',
    text: 'When did it start — month and year if you have it — and when did it end?',
    effort_ceiling: 'low',
    story: false,
    sufficient_when:
      'A start point resolvable to at least a year, and either an end point or confirmed current status.',
    probe_if: [
      'A duration is given with no anchor point.',
      'A season or life event is the only marker and cannot be resolved to a year.',
      'Start and end are given but the role changed substantially mid-way.',
    ],
    probe_examples: [
      'Roughly what year did that start?',
      'And what year was that, give or take?',
      'Which stretch of that shall we take — the whole thing, or the later part?',
    ],
    max_probes: 1,
    current_role_rule:
      'If current, accept immediately, end_date null, set tense to present. Never ask for an end date.',
    never_probe_for: 'Exact months when a year has been offered. Never probe gaps or short tenure.',
  },

  Q3: {
    id: 'Q3',
    section: 'frame',
    text: 'Which company was that, and what did they actually do?',
    text_present: 'Which company is that, and what do they actually do?',
    effort_ceiling: 'low',
    story: false,
    sufficient_when:
      'A nameable company (or clear decline) AND enough description to place what the business does.',
    probe_if: [
      'No company is named and none was declined.',
      'The name is given with no description, and the business is not self-evident.',
      'The description is too generic to derive an industry.',
    ],
    probe_examples: [
      'And what was the company called?',
      'What did they do, in a sentence?',
      'Consulting in what — who were the clients?',
    ],
    max_probes: 1,
    never_probe_for: 'Company size, revenue, headcount, funding stage or market position.',
  },

  Q4: {
    id: 'Q4',
    section: 'frame',
    text: 'And which function or department were you in?',
    text_present: 'And which function or department are you in?',
    effort_ceiling: 'low',
    story: false,
    sufficient_when: 'A function is nameable. Division welcome but not required.',
    probe_if: [
      'Only a division is given, with no function.',
      'The answer is a job family so broad it does not identify a function.',
    ],
    probe_examples: [
      'And what was your function within that?',
      'Operations covering what — supply chain, service, something else?',
    ],
    max_probes: 1,
    never_probe_for:
      'Division size, headcount, reporting lines. Do not ask when function is self-evident from Q1.',
  },

  Q5: {
    id: 'Q5',
    section: 'arrival',
    text: 'How did you get that role?',
    effort_ceiling: 'low',
    story: false,
    sufficient_when: 'The route is identifiable well enough to classify.',
    probe_if: [
      'The answer is procedural rather than a route (interview process).',
      'The route is genuinely ambiguous between active and passive.',
      'A person is mentioned as the door-opener but their relationship is unstated.',
    ],
    probe_examples: [
      'And how did it start — did you go looking, or did it come to you?',
      'How did you first hear about it?',
      "Who was that — someone you'd worked with?",
    ],
    max_probes: 1,
    route_values: [
      'active_search',
      'referral',
      'approached',
      'followed_a_person',
      'internal_move',
      'created_the_role',
      'returned',
      'unclear',
    ],
    never_probe_for: 'Why they wanted it (Q8). Never remark on the route.',
  },

  Q6: {
    id: 'Q6',
    section: 'arrival',
    text: 'What were you hired to do?',
    priority_probe: true,
    story: true,
    sufficient_when:
      'Some account of what the role was for — including "I was never quite sure".',
    probe_if: [
      'The answer lists duties with no purpose.',
      'Unclear what the role was for.',
    ],
    probe_examples: [
      'And what was the role there to achieve, overall?',
      'Was that laid out for you, or was it more yours to define?',
    ],
    max_probes: 2,
    never_probe_for:
      'KPIs, targets, whether they achieved it. Never probe an admission of unclarity for detail. Never offer structural reattribution.',
  },

  Q7: {
    id: 'Q7',
    section: 'arrival',
    text: 'Why do you think they picked you?',
    priority_probe: true,
    story: true,
    wording_by_route: {
      active_search: 'Why do you think they picked you?',
      approached: 'Why do you think they came to you?',
      referral: 'Why do you think they thought of you?',
      followed_a_person: 'Why do you think they wanted you with them?',
      internal_move: 'Why do you think they gave it to you?',
      created_the_role: 'Why do you think they went for it?',
      returned: 'Why do you think they wanted you back?',
      unclear: 'Why do you think it landed with you?',
    },
    sufficient_when: 'Any answer that is genuinely theirs, including a deflection.',
    probe_if: [
      "The answer describes the ROLE's requirements rather than anything about them.",
      'The answer is purely circumstantial AND the person seems willing to go further.',
    ],
    probe_examples: [
      'And why you, out of the people who could have done it?',
      'What did you have that made it you?',
    ],
    max_probes: 1,
    never_probe_for: 'Evidence or proof. Never counter-argue a deflection.',
  },

  Q8: {
    id: 'Q8',
    section: 'arrival',
    text: 'What made you say yes?',
    story: true,
    sufficient_when: 'At least one reason that is actually theirs.',
    probe_if: [
      "The answer describes the move's logic rather than any pull or push.",
      'The answer is purely about the previous role being bad.',
      'A person is named as the reason without saying what about them mattered.',
    ],
    probe_examples: [
      'And what appealed to you about it?',
      'Was there anything about this one that drew you, or was it mostly about leaving?',
      'What was it about working with them?',
    ],
    max_probes: 1,
    family_exception: {
      when: 'No family or personal-life consideration appears AND topic not unwelcome.',
      text: 'And was there anything going on outside work that fed into it?',
    },
    never_probe_for: 'Whether the reason was good. Never probe salary amounts.',
  },

  Q9: {
    id: 'Q9',
    section: 'arrival',
    text: 'How long did it take you to feel confident in the role, and what helped you get that confidence?',
    text_present:
      'How long did it take you to feel confident in the role — or are you still getting there? And what has helped?',
    priority_probe: true,
    story: true,
    sufficient_when: 'Some sense of the ramp AND at least one thing that helped.',
    probe_if: [
      'Only a duration is given, with nothing about what helped.',
      "The answer is entirely about the role's difficulty with nothing about what the person did.",
      'Help is mentioned in the passive with no source.',
    ],
    probe_examples: [
      'And what helped — was there anyone, or anything in particular?',
      'How did you get there in the end?',
      'Who did you lean on, if anyone?',
    ],
    max_probes: 2,
    never_probe_for:
      'Whether onboarding was adequate. Never benchmark the ramp. "Nobody, I just worked it out" is complete.',
  },

  Q10: {
    id: 'Q10',
    section: 'macro',
    text: 'What accomplishment in this role are you most proud of?',
    text_present: 'What accomplishment in this role are you most proud of so far?',
    priority_probe: true,
    story: true,
    sufficient_when: "One accomplishment with at least the person's own ACTION in it.",
    probe_if: [
      'Credit is entirely diffuse with no self in it.',
      'An accomplishment is named with no context at all.',
      'The person lists several and settles on none.',
    ],
    probe_examples: [
      'And what was your part in that?',
      'What was going on that made it hard?',
      'How did it end up?',
    ],
    max_probes: 2,
    never_probe_for:
      'Numbers or metrics. Never suggest an accomplishment. "Honestly, nothing" is significant — accept it.',
  },

  Q11: {
    id: 'Q11',
    section: 'macro',
    text: 'And what were some of the low points?',
    priority_probe: true,
    story: true,
    distress_gate: true,
    sufficient_when: 'At least one low point the listener can SEE — a situation, not a category.',
    probe_if: [
      'A category rather than a situation.',
      'Something named but not placed.',
      'Alluded to and moved past quickly WITHOUT signs of distress.',
    ],
    probe_examples: [
      'What do you mean by that?',
      'What happened?',
      'How did you deal with that?',
      'Tell me more about that one.',
    ],
    denial_probe_examples: [
      'Was there anything that went wrong, even in a small way?',
      "Any part of it you just didn't enjoy?",
      "Anything you'd do differently, looking back?",
    ],
    max_probes: 2,
    never_probe_for:
      'Blame, what they learned (Q20), how it was resolved if unsaid. Never reassure.',
  },

  role_system_intro: {
    id: 'role_system_intro',
    section: 'role_system',
    type: 'section_intro',
    text: "Now I'd like to talk about the people you worked with in that role. Who did you report to?",
    story: false,
    sufficient_when:
      'Enough to place boss configuration: single, sequential, dual reporting, or none.',
    probe_if: ['Unclear who they reported to.', 'Ambiguous dual vs single reporting.'],
    probe_examples: [
      'Was that one person, or more than one?',
      'And was that the whole time, or did it change?',
    ],
    max_probes: 1,
    never_probe_for: 'Org-chart detail beyond who owned their time.',
  },

  Q12: {
    id: 'Q12',
    section: 'role_system',
    text: 'What was it like working with them?',
    condition: 'boss_configuration in [single, sequential]',
    priority_probe: true,
    story: true,
    sufficient_when: 'The listener can picture the relationship.',
    probe_if: [
      'The answer is short or generic and paints no picture.',
      'Only a character assessment is given, with no working relationship.',
    ],
    probe_examples: [
      'Tell me more.',
      'What was that like day to day?',
      "What's an example of that?",
    ],
    max_probes: 2,
    sequential_note:
      'If several bosses in sequence: ask who mattered most, then a light pass on the others.',
    never_probe_for: 'Whether the boss was good at their job.',
  },

  Q13: {
    id: 'Q13',
    section: 'role_system',
    text: 'What was it like having two?',
    condition: 'boss_configuration == dual_reporting',
    priority_probe: true,
    story: true,
    followup:
      'And when they wanted different things, how did that play out?',
    sufficient_when: 'Some account of how the two-headed structure worked in practice.',
    probe_if: [
      'The answer stays abstract or diplomatic.',
      'Conflict is alluded to but not described.',
    ],
    probe_examples: [
      'How did that work in practice — who actually decided?',
      'What happened when they disagreed?',
      'What did you do?',
    ],
    max_probes: 2,
    never_probe_for: 'Which one they preferred, or whose side they were on.',
  },

  Q14: {
    id: 'Q14',
    section: 'role_system',
    text: 'What would they say were your biggest strengths, and your areas for improvement?',
    priority_probe: true,
    story: true,
    sufficient_when: 'At least one strength AND one area for improvement, specific enough to picture.',
    probe_if: [
      'Only strengths are given.',
      'The answer is a generic trait list with nothing role-specific.',
    ],
    probe_examples: [
      'And what would they have said you needed to work on?',
      "What's your best guess?",
    ],
    max_probes: 2,
    dont_know_probe: "What's your best guess?",
    never_probe_for: 'Whether they agreed with the assessment.',
  },

  Q15: {
    id: 'Q15',
    section: 'role_system',
    text: 'How would you rate the team you inherited?',
    condition: 'is_managerial == true',
    priority_probe: true,
    story: true,
    sufficient_when: 'Some assessment of the team AND some sense of what the person did in response.',
    probe_if: [
      'A rating is given with nothing about what they did.',
      'Changes are mentioned generically.',
    ],
    probe_examples: [
      'And what did you do about that?',
      'What changes did you make?',
      'How long did that take?',
    ],
    max_probes: 2,
    never_probe_for: 'Names or details of anyone removed or dismissed.',
  },

  Q16: {
    id: 'Q16',
    section: 'role_system',
    text: 'And what would your team have said were your strengths, and the things you could have done better?',
    condition: 'is_managerial == true',
    priority_probe: true,
    story: true,
    sufficient_when: 'At least one strength AND one shortfall, specific enough to picture.',
    probe_if: [
      'Only strengths are given.',
      'The answer merely repeats Q14 verbatim.',
    ],
    probe_examples: [
      'And what would they have wanted more of from you?',
      "What's your best guess?",
    ],
    max_probes: 2,
    never_probe_for: 'Whether they were a good manager. Do not name Q14/Q16 inconsistencies live.',
  },

  Q17: {
    id: 'Q17',
    section: 'role_system',
    text: 'Who else really mattered in that role?',
    story: true,
    sufficient_when:
      'Either at least one person with some sense of WHY, or a clear indication nobody stands out.',
    probe_if: [
      'A name is given with no account of the impact.',
      'Several names arrive as a list with no differentiation.',
    ],
    probe_examples: [
      'What did they do for you?',
      'What difference did they make?',
      'Which of them mattered most?',
    ],
    max_probes: 1,
    never_probe_for: 'Where they are now, whether still in touch, contact details.',
  },

  Q18: {
    id: 'Q18',
    section: 'micro',
    text: 'Thinking back to the day to day — what stood out? What gave you energy, and what drained you?',
    story: true,
    bridge_before: true,
    sufficient_when: 'Anything at all, including nothing.',
    silence_note: 'A pause is productive. Do not fill it. Offer exit only after a long pause.',
    probe_if: [
      'Something IS named but stays a category with no picture attached.',
    ],
    probe_examples: ['What was that like?', 'Tell me more about that.'],
    max_probes: 1,
    never_probe_for: 'Tools, software, or any capture element that did not surface on its own.',
  },

  Q19: {
    id: 'Q19',
    section: 'exit',
    text: "What's the story behind leaving this role?",
    condition: 'role is not current',
    priority_probe: true,
    story: true,
    distress_gate: true,
    sufficient_when:
      'The listener can see how the role ended — route out, and some sense of how it landed (or halted experience is complete).',
    probe_if: [
      'The account is entirely abstract.',
      'Only the factual route is given, with no experience — and no distress signals.',
      'The reason given is external and unelaborated.',
    ],
    probe_examples: [
      'What happened?',
      'Tell me more.',
      'How did that come about?',
      'What was that like for you?',
    ],
    conditional_followup: {
      when: 'The person chose to leave, for an external move.',
      text: 'And how did your boss react to the news?',
    },
    max_probes: 2,
    never_probe_for:
      'Financial terms, settlement, regret, going back. Distress gate overrides curiosity.',
  },

  Q20: {
    id: 'Q20',
    section: 'exit',
    text: "If there's one thing this role taught you, what is it?",
    priority_probe: true,
    story: true,
    sufficient_when: 'One thing, in their own words, specific enough to mean something.',
    probe_if: [
      'The answer is a platitude with no content.',
      'Several lessons are listed with none settled on.',
    ],
    probe_examples: [
      'What do you mean by that?',
      'Which of those has stayed with you most?',
      'How did you come to that?',
    ],
    max_probes: 1,
    never_probe_for: 'Whether they have applied it. Never affirm as wisdom.',
  },

  Q21: {
    id: 'Q21',
    section: 'exit',
    text: "What else about this role matters that we haven't touched?",
    story: true,
    sufficient_when: 'Anything, including nothing.',
    probe_if: ['Something is raised but stays generic.'],
    probe_examples: ['Tell me more.', 'What do you mean by that?'],
    max_probes: 1,
    never_probe_for: 'Anything already asked. Do not pursue material belonging to a different role.',
  },
}

export function getQuestion(id) {
  return QUESTIONS[id] || null
}

export function questionText(question, tense = 'past') {
  if (!question) return ''
  if (tense === 'present' && question.text_present) return question.text_present
  return question.text
}

export function q7Text(route) {
  const q = QUESTIONS.Q7
  return q.wording_by_route[route] || q.wording_by_route.unclear || q.text
}

export function sectionLabel(section) {
  const labels = {
    frame: 'Frame',
    arrival: 'Arrival',
    macro: 'The bigger picture',
    role_system: 'People',
    micro: 'Day to day',
    exit: 'Closing',
  }
  return labels[section] || section
}

/** Core answerable question ids (excludes section intros). */
export const CORE_QUESTION_IDS = QUESTION_ORDER.filter((id) => !id.includes('intro'))
