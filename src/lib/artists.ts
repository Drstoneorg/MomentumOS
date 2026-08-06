import type { Enums } from "@/lib/database.types"

// Booking-Pipeline eines Gigs; played/cancelled sind final.
export const GIG_FLOW: Enums<"gig_status">[] = [
  "idea",
  "inquired",
  "negotiating",
  "confirmed",
  "contracted",
  "played",
]

export const GIG_STATUS_LABELS: Record<Enums<"gig_status">, string> = {
  idea: "Idee",
  inquired: "Angefragt",
  negotiating: "Verhandlung",
  confirmed: "Bestätigt",
  contracted: "Vertrag fix",
  played: "Gespielt",
  cancelled: "Abgesagt",
}

export const GIG_STATUS_COLOR: Record<Enums<"gig_status">, string> = {
  idea: "bg-zinc-800 text-zinc-300",
  inquired: "bg-amber-900/60 text-amber-300",
  negotiating: "bg-sky-900/60 text-sky-300",
  confirmed: "bg-emerald-900/60 text-emerald-300",
  contracted: "bg-violet-900/60 text-violet-300",
  played: "bg-zinc-800 text-emerald-400",
  cancelled: "bg-zinc-800 text-zinc-500",
}

export const ARTIST_TYPE_LABELS: Record<Enums<"artist_type">, string> = {
  dj: "DJ",
  live_act: "Live-Act",
  band: "Band",
  performer: "Performer",
  other: "Sonstiges",
}

// Nächster Pipeline-Schritt oder null, wenn final (played/cancelled/unbekannt).
export function nextGigStatus(s: Enums<"gig_status">): Enums<"gig_status"> | null {
  const i = GIG_FLOW.indexOf(s)
  if (i < 0 || i === GIG_FLOW.length - 1) return null
  return GIG_FLOW[i + 1]
}

// Euro-Anzeige ohne unnötige Nachkommastellen: 30000 → "300 €", 35050 → "350,50 €"
export function formatEuro(cents: number): string {
  const hasCents = cents % 100 !== 0
  const num = (cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })
  return `${num} €`
}

// Gagen-Spanne fürs Roster: beide → "300–500 €", nur min → "ab 300 €",
// nur max → "bis 500 €", gleich → "300 €", keine Angabe → null.
export function formatFeeRange(
  minCents: number | null,
  maxCents: number | null,
): string | null {
  if (minCents == null && maxCents == null) return null
  if (minCents != null && maxCents != null) {
    if (minCents === maxCents) return formatEuro(minCents)
    const num = (c: number) =>
      (c / 100).toLocaleString("de-DE", {
        minimumFractionDigits: c % 100 !== 0 ? 2 : 0,
        maximumFractionDigits: 2,
      })
    return `${num(minCents)}–${num(maxCents)} €`
  }
  return minCents != null ? `ab ${formatEuro(minCents)}` : `bis ${formatEuro(maxCents!)}`
}

// Deutsche Gagen-Eingabe → Cents: "350" → 35000, "350,50" → 35050, "1.200" → 120000.
// Leer/negativ/Unsinn → null. Punkt gilt als Tausendertrenner, Komma als Dezimaltrenner.
export function parseFeeInput(raw: string): number | null {
  const s = raw.trim().replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".")
  if (!s) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

// Nach so vielen Tagen ohne Statuswechsel gilt eine Anfrage als unbeantwortet
export const GIG_STALE_DAYS = 5

/**
 * Follow-up-Radar: Tage, die ein Gig schon in inquired/negotiating festhängt —
 * ab GIG_STALE_DAYS. Andere Status oder frisch → null.
 */
export function gigStaleDays(
  status: Enums<"gig_status">,
  statusChangedAt: string,
  now = new Date(),
): number | null {
  if (status !== "inquired" && status !== "negotiating") return null
  const changed = new Date(statusChangedAt).getTime()
  if (isNaN(changed)) return null
  const days = Math.floor((now.getTime() - changed) / 86400_000)
  return days >= GIG_STALE_DAYS ? days : null
}

/**
 * Set-Slot-Freitext ("23–01", "23:30-01:00", "22 Uhr bis 0 Uhr") → Minutenfenster.
 * Skala: Minuten seit 12:00 Mittag — Stunden < 12 zählen als nach Mitternacht,
 * damit Club-Nächte (23–01) korrekt über die Datumsgrenze sortieren.
 * Nicht parsebar → null.
 */
export function parseSetSlot(slot: string | null | undefined): { start: number; end: number } | null {
  if (!slot) return null
  const m = slot.match(
    /(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?\s*(?:–|—|-|bis)\s*(\d{1,2})(?::(\d{2}))?/i,
  )
  if (!m) return null
  const toMin = (h: number, min: number) => {
    if (h > 23 || min > 59) return null
    const mapped = h < 12 ? h + 24 : h // 0-11 Uhr = nach Mitternacht
    return (mapped - 12) * 60 + min
  }
  const start = toMin(Number(m[1]), Number(m[2] ?? 0))
  let end = toMin(Number(m[3]), Number(m[4] ?? 0))
  if (start == null || end == null) return null
  if (end <= start) end += 24 * 60 // "23–23" o.ä.: als Über-Nacht werten
  return { start, end }
}

// Überschneiden sich zwei Slots? (Berührung Ende=Start ist KEIN Konflikt)
export function slotsOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end
}

// --- Zielpublikum-Passung Event ↔ Artist -----------------------------------

// Synonymgruppen: verschiedene Schreibweisen desselben Publikums zählen als
// ein Token (erstes Wort der Gruppe ist der kanonische Name).
const AUDIENCE_GROUPS: string[][] = [
  ["goth", "gothic", "darkwave", "dark"],
  ["alt", "alternative", "punk", "emo", "grunge"],
  ["aesthetic", "asthetisch", "fashion", "editorial"],
  ["techno", "hypertechno", "rave", "schranz"],
  ["edm", "trance", "hardstyle", "festival"],
  ["metal", "industrial", "ebm", "wave"],
  ["queer", "lgbt", "lgbtq", "inclusive", "divers"],
  ["mainstream", "charts", "hits", "pop", "kommerziell"],
]

// Füllwörter, die in Publikums-Beschreibungen nichts unterscheiden — ohne
// diese Liste drückt "…-Publikum" oder "crowd" den Score künstlich runter.
const AUDIENCE_STOPWORDS = new Set([
  "und", "and", "the", "mit", "fur", "fuer", "von", "bis", "oder",
  "publikum", "zielgruppe", "audience", "crowd", "leute", "szene", "fans", "gaeste",
])

function audienceTokens(text: string): Set<string> {
  const umlautfrei = text
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => (({ "ä": "a", "ö": "o", "ü": "u", "ß": "ss" }) as Record<string, string>)[c] ?? c)
  const out = new Set<string>()
  for (const w of umlautfrei.split(/[^a-z0-9]+/)) {
    if (w.length < 3) continue // Zahlen/Altersspannen wie "18-30" bewusst raus
    if (AUDIENCE_STOPWORDS.has(w)) continue
    const gruppe = AUDIENCE_GROUPS.find((g) => g.includes(w))
    out.add(gruppe ? gruppe[0] : w)
  }
  return out
}

/**
 * Wie gut passt ein Artist-Publikum zu einem Event-Publikum? Overlap-Koeffizient
 * (Schnittmenge / kleinere Menge) über synonym-normalisierte Tokens, 0–100 —
 * bewusst kein Jaccard: ein ausführlich beschriebenes Event soll einen knapp
 * beschriebenen, voll passenden Artist nicht abwerten. null = keine Aussage
 * möglich (ein Feld leer) — unterschieden von "0 = passt nicht".
 */
export function audienceMatch(
  a: string | null | undefined,
  b: string | null | undefined
): { score: number; gemeinsam: string[] } | null {
  if (!a?.trim() || !b?.trim()) return null
  const ta = audienceTokens(a)
  const tb = audienceTokens(b)
  if (!ta.size || !tb.size) return null
  const gemeinsam = [...ta].filter((t) => tb.has(t)).sort()
  return {
    score: Math.round((gemeinsam.length / Math.min(ta.size, tb.size)) * 100),
    gemeinsam,
  }
}

// Gagen-Summen für die Übersicht: fix = confirmed/contracted/played,
// offen = inquired/negotiating (Ideen und Absagen zählen nicht).
export function gigFeeTotals(
  gigs: { status: Enums<"gig_status">; fee_cents: number | null }[],
): { fixedCents: number; pendingCents: number } {
  let fixedCents = 0
  let pendingCents = 0
  for (const g of gigs) {
    if (!g.fee_cents) continue
    if (g.status === "confirmed" || g.status === "contracted" || g.status === "played") {
      fixedCents += g.fee_cents
    } else if (g.status === "inquired" || g.status === "negotiating") {
      pendingCents += g.fee_cents
    }
  }
  return { fixedCents, pendingCents }
}

// ---------- Verfügbarkeitskalender ----------

/** Belegt zählt alles außer Absage und loser Idee — angefragt blockt schon. */
export function blocktTermin(status: string): boolean {
  return status !== "cancelled" && status !== "idea"
}

/**
 * Monatsraster als Wochenzeilen (Montag zuerst), Einträge sind ISO-Daten
 * oder null als Füllung vor dem 1. / nach dem letzten Tag.
 */
export function kalenderWochen(jahr: number, monat: number): (string | null)[][] {
  const erster = new Date(Date.UTC(jahr, monat - 1, 1))
  const tage = new Date(Date.UTC(jahr, monat, 0)).getUTCDate()
  const offset = (erster.getUTCDay() + 6) % 7 // So=0 → Mo-Start
  const zellen: (string | null)[] = Array(offset).fill(null)
  for (let t = 1; t <= tage; t++) {
    zellen.push(`${jahr}-${String(monat).padStart(2, "0")}-${String(t).padStart(2, "0")}`)
  }
  while (zellen.length % 7 !== 0) zellen.push(null)
  const wochen: (string | null)[][] = []
  for (let i = 0; i < zellen.length; i += 7) wochen.push(zellen.slice(i, i + 7))
  return wochen
}

/**
 * Nächste freie Wochenenden (Fr+Sa beide ohne Gig) ab einem Datum.
 * Fr/Sa statt Sa/So, weil Club-Nächte auf diese Abende fallen.
 */
export function freieWochenenden(
  belegt: Set<string>,
  abIso: string,
  anzahl = 6
): { freitag: string; samstag: string }[] {
  const start = new Date(`${abIso}T00:00:00Z`)
  // Zum nächsten Freitag vorspulen
  const tag = start.getUTCDay()
  const bisFreitag = (5 - tag + 7) % 7
  start.setUTCDate(start.getUTCDate() + bisFreitag)

  const out: { freitag: string; samstag: string }[] = []
  for (let woche = 0; woche < 26 && out.length < anzahl; woche++) {
    const fr = new Date(start)
    fr.setUTCDate(start.getUTCDate() + woche * 7)
    const sa = new Date(fr)
    sa.setUTCDate(fr.getUTCDate() + 1)
    const frIso = fr.toISOString().slice(0, 10)
    const saIso = sa.toISOString().slice(0, 10)
    if (!belegt.has(frIso) && !belegt.has(saIso)) out.push({ freitag: frIso, samstag: saIso })
  }
  return out
}
