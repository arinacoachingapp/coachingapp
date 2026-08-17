# Role Card generator (P2) — v1.1

Pairs with interviewer P1 and question bank v1.1.

The live prompt is assembled in `server/generateRoleCard.js` from the stored
transcript + `interview_state` (tense, route, names, version triple).

## Rules

- Generate **only** on a complete interview (`phase: ready_for_card`).
- Stay in the person's words; no recruiter polish.
- Insight lives on the card (`biggest_insight`), not in the live interview.
- Empty `ending` when the role is current.

## Versioning

Every session records `{ interviewer, bank, card }` so pilot feedback can be
attributed. Bump `CARD_VERSION` in `server/interview/versions.js` when this
prompt changes.
