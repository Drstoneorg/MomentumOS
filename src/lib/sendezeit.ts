/**
 * Sendezeit-Lernen: aus den Zeitstempeln EINGEHENDER Nachrichten pro Kontakt
 * ableiten, wann die Person typischerweise aktiv ist — „meist Do abends".
 * Rein deterministisch, Zeitzone Wien (Server läuft in UTC).
 */

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
const TAGESZEITEN = ["nachts", "vormittags", "nachmittags", "abends"] as const

export const SENDEZEIT_MIN_NACHRICHTEN = 5
/** Der Top-Bucket muss mindestens so viel Anteil haben, sonst kein Muster. */
const MIN_ANTEIL = 0.3

function bucket(iso: string): { tag: number; zeit: number } | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  // Wochentag + Stunde in Wiener Zeit bestimmen
  const teile = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Vienna",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(d)
  const wd = teile.find((p) => p.type === "weekday")?.value ?? ""
  const stunde = Number(teile.find((p) => p.type === "hour")?.value ?? "-1")
  const tag = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd)
  if (tag < 0 || stunde < 0 || stunde > 24) return null
  const zeit = stunde < 6 ? 0 : stunde < 12 ? 1 : stunde < 18 ? 2 : 3
  return { tag, zeit }
}

/**
 * „meist Do abends" oder null, wenn zu wenig Daten oder kein klares Muster.
 * Erwartet Zeitstempel eingehender Nachrichten (die Person war da aktiv).
 */
export function besteSendezeit(zeitstempel: string[]): string | null {
  if (zeitstempel.length < SENDEZEIT_MIN_NACHRICHTEN) return null
  const zaehler = new Map<string, number>()
  let gesamt = 0
  for (const iso of zeitstempel) {
    const b = bucket(iso)
    if (!b) continue
    gesamt++
    const key = `${b.tag}:${b.zeit}`
    zaehler.set(key, (zaehler.get(key) ?? 0) + 1)
  }
  if (gesamt < SENDEZEIT_MIN_NACHRICHTEN) return null

  let topKey: string | null = null
  let topN = 0
  for (const [k, n] of zaehler) {
    if (n > topN) {
      topN = n
      topKey = k
    }
  }
  if (!topKey || topN / gesamt < MIN_ANTEIL || topN < 3) return null
  const [tag, zeit] = topKey.split(":").map(Number)
  return `meist ${WOCHENTAGE[tag]} ${TAGESZEITEN[zeit]}`
}

/** Für viele Kontakte auf einmal — eine Map contactId → Label. */
export function sendezeitProKontakt(
  nachrichten: { contact_id: string; sent_at: string }[]
): Map<string, string> {
  const proKontakt = new Map<string, string[]>()
  for (const m of nachrichten) {
    const arr = proKontakt.get(m.contact_id) ?? []
    arr.push(m.sent_at)
    proKontakt.set(m.contact_id, arr)
  }
  const ergebnis = new Map<string, string>()
  for (const [id, stempel] of proKontakt) {
    const label = besteSendezeit(stempel)
    if (label) ergebnis.set(id, label)
  }
  return ergebnis
}
