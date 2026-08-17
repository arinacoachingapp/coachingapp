/** Prompt / bank / card version triple for every pilot session. */
export const INTERVIEWER_VERSION = '1.1'
export const BANK_VERSION = '1.1'
export const CARD_VERSION = '1.1'

export function versionTriple() {
  return {
    interviewer: INTERVIEWER_VERSION,
    bank: BANK_VERSION,
    card: CARD_VERSION,
  }
}
