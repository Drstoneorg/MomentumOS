/**
 * Chat-Zusagen-Erkennung: erkennt in erfassten Nachrichten, ob jemand einem
 * Event zu- oder absagt, ohne den RSVP-Link geklickt zu haben. Bewusst
 * konservativ — lieber kein Vorschlag als ein falscher. Das Ergebnis wird NIE
 * automatisch übernommen, es landet als Vermutung am Invite und wird im
 * Assistenten per Klick bestätigt oder verworfen.
 */

export type RsvpVermutung = { status: "yes" | "no"; zitat: string }

// Absagen zuerst prüfen: „kann leider nicht kommen" enthält sonst „komme"
const NEIN = [
  /\bkann (leider |diesmal |da |doch )?(nicht|ned)\b/i,
  /\bschaff('?s| es| ich)? (leider )?nicht\b/i,
  /\bbin (leider )?raus\b/i,
  /\bmuss (leider )?absagen\b/i,
  /\bwird (leider )?nichts bei mir\b/i,
  /\bdiesmal (leider )?nicht\b/i,
  /\bkeine zeit\b/i,
  /\bcan'?t (make it|come)\b/i,
  /\bwon'?t (make it|be there)\b/i,
  /\bnot going to make it\b/i,
  /\bhave to cancel\b/i,
]

const JA = [
  /\bbin (fix |sicher |auf jeden fall )?dabei\b/i,
  /\bbin am start\b/i,
  /\bich komm(e)? (fix|sicher|auf jeden fall|gern|gerne|vorbei|hin)\b/i,
  /\bwir kommen\b/i,
  /\bsag(e)? (fix )?zu\b/i,
  /\bza[eä]hl auf mich\b/i,
  /\bfreu(e)? mich( schon)?( sehr)?( drauf| darauf)\b/i,
  /\bcount me in\b/i,
  /\bi('| a)?m in\b/i,
  /\bi'?ll be there\b/i,
  /\bsee you there\b/i,
]

/** Kürzt das Zitat auf den Satz rund um den Treffer. */
function zitatUm(text: string, index: number): string {
  const start = Math.max(0, text.lastIndexOf("\n", index))
  const roh = text.slice(start, start + 160).trim()
  return roh.length > 120 ? `${roh.slice(0, 117)}…` : roh
}

/** Prüft EINE Nachricht. Absage-Muster gewinnen gegen Zusage-Muster. */
export function erkenneRsvp(text: string): RsvpVermutung | null {
  if (!text || text.length > 2000) return null
  for (const re of NEIN) {
    const m = re.exec(text)
    if (m) return { status: "no", zitat: zitatUm(text, m.index) }
  }
  for (const re of JA) {
    const m = re.exec(text)
    if (m) return { status: "yes", zitat: zitatUm(text, m.index) }
  }
  return null
}

/**
 * Prüft einen Schwung frischer Nachrichten in Chronologie-Reihenfolge —
 * die späteste Aussage gewinnt („bin dabei … ach nee, kann doch nicht").
 */
export function erkenneRsvpAusNachrichten(texte: string[]): RsvpVermutung | null {
  let letzte: RsvpVermutung | null = null
  for (const t of texte) {
    const v = erkenneRsvp(t)
    if (v) letzte = v
  }
  return letzte
}
