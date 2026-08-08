/**
 * No-Show-Mathe: aus vergangenen Events lernen, wie viele Zusagen am Ende
 * wirklich kommen — und daraus eine Überbuchungs-Empfehlung ableiten.
 * „Ziel 40, Quote 25 % → 54 Zusagen anpeilen".
 */

export type NoShowStand = {
  zugesagt: number
  erschienen: number
  /** 0..1, null wenn zu wenig Datenbasis */
  quote: number | null
}

/** Mindestens so viele Zusagen aus der Vergangenheit, bevor die Quote zählt. */
export const NO_SHOW_MIN_BASIS = 5

/**
 * Invites VERGANGENER Events: yes/ticket zählten als Zusage, attended als
 * erschienen (attended impliziert Zusage). Wer nur eingeladen war, zählt nicht.
 */
export function noShowQuote(pastInvites: { status: string }[]): NoShowStand {
  let zugesagt = 0
  let erschienen = 0
  for (const i of pastInvites) {
    if (["yes", "ticket", "attended"].includes(i.status)) zugesagt++
    if (i.status === "attended") erschienen++
  }
  const quote =
    zugesagt >= NO_SHOW_MIN_BASIS ? Math.max(0, Math.min(1, 1 - erschienen / zugesagt)) : null
  return { zugesagt, erschienen, quote }
}

/**
 * Wie viele Zusagen für das Ziel anpeilen. Quote gekappt bei 60 % — darüber
 * wäre die Empfehlung Fantasie (und das eigentliche Problem ein anderes).
 */
export function ueberbuchungsEmpfehlung(ziel: number, quote: number): number {
  const q = Math.max(0, Math.min(0.6, quote))
  return Math.ceil(ziel / (1 - q))
}
