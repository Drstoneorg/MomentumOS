/**
 * Zusagen-Erkennung in eingehenden Nachrichten — pure Regex, keine KI-Kosten.
 * „meld mich nächste Woche" → Follow-up-Datum. Bewusst konservativ: ohne
 * Zusage-Phrase kein Treffer, Zeitangabe verfeinert nur das Datum.
 */
export type PromiseHit = {
  /** Fälligkeitsdatum (09:00 UTC des Zieltags) */
  dueAt: Date
  /** was erkannt wurde, für den Follow-up-Text */
  label: string
}

const COMMIT_PATTERNS: RegExp[] = [
  /\bmelde?\s+mich\b/i,
  /\bmeld\s+mich\b/i,
  /\bsag\w*\s+(dir|euch)\s+bescheid\b/i,
  /\bgeb\w*\s+(dir|euch)\s+bescheid\b/i,
  /\bschreib\w*\s+dir\b/i,
  /\bkomme?\s+auf\s+dich\s+zur(ü|ue)ck\b/i,
  /\bh(ö|oe)rst\s+von\s+mir\b/i,
  /\blass\s+uns\s+(dann|danach)\s+(was\s+)?ausmachen\b/i,
]

const WEEKDAYS = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"]

/** Standard-Vorlauf, wenn eine Zusage ohne Zeitangabe kommt. */
export const DEFAULT_PROMISE_DAYS = 4

function atNineUtc(base: Date, addDays: number): Date {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + addDays, 9, 0, 0))
  return d
}

/** Zeitausdruck → Tage ab heute; null wenn keiner erkannt. */
export function resolveTimePhrase(text: string, now: Date): { days: number; phrase: string } | null {
  const t = text.toLowerCase()

  const inDays = t.match(/\bin\s+(\d{1,2})\s+tagen?\b/)
  if (inDays) return { days: Number(inDays[1]), phrase: inDays[0] }
  // \b greift vor Umlauten nicht (ASCII-Wortgrenze) — deshalb (^|\s)
  if (/(^|\s)(ü|ue)bermorgen\b/.test(t)) return { days: 2, phrase: "übermorgen" }
  if (/\bmorgen\b/.test(t)) return { days: 1, phrase: "morgen" }
  if (/\bn(ä|ae)chste\s+woche\b/.test(t)) {
    // nächster Montag
    const dow = now.getUTCDay()
    return { days: ((8 - dow) % 7) || 7, phrase: "nächste Woche" }
  }
  if (/\b(am\s+)?wochenende\b/.test(t)) {
    const dow = now.getUTCDay()
    return { days: ((6 - dow) % 7) || 7, phrase: "am Wochenende" }
  }
  if (/\bnach\s+dem\s+urlaub\b/.test(t)) return { days: 10, phrase: "nach dem Urlaub" }
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b(am\\s+)?${WEEKDAYS[i]}\\b`).test(t)) {
      const dow = now.getUTCDay()
      const days = ((i - dow + 7) % 7) || 7
      return { days, phrase: WEEKDAYS[i] }
    }
  }
  return null
}

export function detectPromise(text: string, now = new Date()): PromiseHit | null {
  if (!text || text.length > 2000) return null
  const commit = COMMIT_PATTERNS.find((p) => p.test(text))
  if (!commit) return null
  const time = resolveTimePhrase(text, now)
  const days = time?.days ?? DEFAULT_PROMISE_DAYS
  return {
    dueAt: atNineUtc(now, days),
    label: time ? `Zusage („${time.phrase}")` : "Zusage",
  }
}

/** Kurzes Zitat für den Follow-up-Text. */
export function promiseSnippet(text: string, max = 70): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`
}
