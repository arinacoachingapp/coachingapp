/** Fixed interview sequence — opening, 22 questions, closing. */

export const OPENING = {
  key: 'opening',
  type: 'message',
  text:
    "Let's build a picture of one professional role you've had. Please pick one to start with and I'll ask you a few questions. Before we start, let's agree to talk about it as if you were talking to a trusted friend, not to a recruiter, OK? It will take us about 15–20 minutes, and at the end you'll get the role summary, in your own words.",
};

export const INTERVIEW_QUESTIONS = [
  {
    key: 'q1',
    number: 1,
    text: "Let's start with the basics. What was the role, its exact title?",
  },
  {
    key: 'q2',
    number: 2,
    text: 'When was it roughly, how long did it last?',
  },
  {
    key: 'q3',
    number: 3,
    text: 'What is the name of the company?',
  },
  {
    key: 'q4',
    number: 4,
    text: 'Which industry was it?',
  },
  {
    key: 'q5',
    number: 5,
    text:
      'Please tell me how you learned about the role. Was it through a referral, a headhunter or anything else? And what made you take it?',
  },
  {
    key: 'q6',
    number: 6,
    text:
      'How would you describe the overall business context of the company when you joined, for example, growth, restructuring, something else?',
  },
  {
    key: 'q7',
    number: 7,
    text: 'Which part of the business were you joining and how big was it?',
  },
  {
    key: 'q8',
    number: 8,
    text: 'What exactly were you hired to do, how clear were the expectations?',
  },
  {
    key: 'q9',
    number: 9,
    text:
      'Who was your hiring manager? What was your relationship like and what part did they play in what happened for you in this role?',
  },
  {
    key: 'q10',
    number: 10,
    text:
      'Were you leading a team, and if yes, how big was it and how many direct reports did you have?',
  },
  {
    key: 'q11',
    number: 11,
    text:
      'Please tell me about the environment you were in – the practical rhythm like hours and work from home flexibility, the physical space and the culture around you? Which of those mattered most?',
  },
  {
    key: 'q12',
    number: 12,
    text:
      'How long did it take you to take the role and feel comfortable in it? What were the key things you did to become autonomous and confident in the role?',
  },
  {
    key: 'q13',
    number: 13,
    text:
      'Now, please walk me through your typical working day in this role: what did you do, what were the tools you used and who were the people and teams you were most frequently interacting with.',
  },
  {
    key: 'q14',
    number: 14,
    text:
      'Which parts of your typical working day energized you, gave you a sense of meaning and momentum?',
  },
  {
    key: 'q15',
    number: 15,
    text: 'Which parts of your typical working day drained you or felt like a grind?',
  },
  {
    key: 'q16',
    number: 16,
    text: 'How would you describe your biggest achievements in this role?',
  },
  {
    key: 'q17',
    number: 17,
    text: 'When you think about your time in this role, what did you like the most?',
  },
  {
    key: 'q18',
    number: 18,
    text: 'And again, when you think about your entire time in the role, what were you missing?',
  },
  {
    key: 'q19',
    number: 19,
    text: 'What was your biggest challenge in this role?',
  },
  {
    key: 'q20',
    number: 20,
    text: 'If you are no longer in this role, how did it end?',
  },
  {
    key: 'q21',
    number: 21,
    text:
      'Lastly, if there is one key thing you learned from this role – it could be an insight, a skill, really, anything else – what would that be?',
  },
  {
    key: 'q22',
    number: 22,
    text: 'What else is important for you for this role that we have not discussed?',
  },
];

export const CLOSING = {
  key: 'closing',
  type: 'message',
  text: "Thank you, that's everything for this role. Please give me a moment to put this together.",
};

/** Total answerable steps (q1–q22). */
export const TOTAL_QUESTIONS = INTERVIEW_QUESTIONS.length;

/** Step index: 0 = opening, 1–22 = questions, 23 = closing, 24 = done */
export const STEP_OPENING = 0;
export const STEP_FIRST_QUESTION = 1;
export const STEP_CLOSING = TOTAL_QUESTIONS + 1;
export const STEP_DONE = TOTAL_QUESTIONS + 2;

export function stepToQuestionKey(step) {
  if (step === STEP_OPENING) return OPENING.key;
  if (step >= STEP_FIRST_QUESTION && step <= TOTAL_QUESTIONS) {
    return INTERVIEW_QUESTIONS[step - 1].key;
  }
  if (step === STEP_CLOSING) return CLOSING.key;
  return null;
}

export function questionKeyToStep(key) {
  if (key === OPENING.key) return STEP_OPENING;
  const idx = INTERVIEW_QUESTIONS.findIndex((q) => q.key === key);
  if (idx >= 0) return idx + 1;
  if (key === CLOSING.key) return STEP_CLOSING;
  return null;
}

export function getStepContent(step) {
  if (step === STEP_OPENING) return OPENING;
  if (step >= STEP_FIRST_QUESTION && step <= TOTAL_QUESTIONS) {
    return INTERVIEW_QUESTIONS[step - 1];
  }
  if (step === STEP_CLOSING) return CLOSING;
  return null;
}

export function progressPercent(step) {
  if (step <= STEP_OPENING) return 0;
  if (step >= STEP_DONE) return 100;
  return Math.round(((step - 1) / TOTAL_QUESTIONS) * 100);
}
