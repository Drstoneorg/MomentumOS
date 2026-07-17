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
