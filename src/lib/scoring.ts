import type { Enums } from "@/lib/database.types"

/**
 * Match-Score (0-100) fuer Dating-Kontakte. Bewusst einfach, drei Fragen:
 * antwortet die Person, wohnt sie in Wien, ist sie bereit fuer ein Treffen.
 * Interner Score nur fuer mich, wird NIE in KI-Prompts, Karten oder
 * Bild-Generierung verwendet.
 *
 * Rein, testbar, ohne DB.
 */

export type ScoreMessage = { direction: "in" | "out"; sent_at: string }

// Stages, die Treffen-Bereitschaft zeigen (volle Punkte),
// bzw. sichtbares Interesse (halbe Punkte).
const MEETING_READY: Enums<"pipeline_stage">[] = [
  "date_idea",
  "date_proposed",
  "scheduling",
  "date_planned",
  "calendar_created",
]
const INTEREST: Enums<"pipeline_stage">[] = [
  "interest_visible",
  "platform_switch",
  "on_messenger",
]

export type ScoreFactor = { key: string; label: string; value: number; weight: number; note: string }

export type MatchScore = {
  score: number
  label: string
  color: string // Tailwind bg-Klasse
  factors: ScoreFactor[]
}

const DAY = 86_400_000

/**
 * Drei Faktoren:
 * - Antwortet (50): schreibt die Person zurueck, und wie frisch ist die letzte Antwort.
 * - Treffen-bereit (30): Pipeline-Stage Richtung Date (Interesse = halbe Punkte).
 * - Wien (20): wohnt in Wien (Ort enthaelt "wien" oder "vienna").
 */
export function datingScore(
  messages: ScoreMessage[],
  contact: {
    pipeline_stage: Enums<"pipeline_stage">
    archived?: boolean
    location?: string | null
  },
  now = Date.now()
): MatchScore {
  const factors: ScoreFactor[] = []

  // Antwortet: gibt es eingehende Nachrichten, und wie lange ist die letzte her?
  const inbound = messages.filter((m) => m.direction === "in")
  const lastInAt = inbound.reduce<number>((max, m) => {
    const t = new Date(m.sent_at).getTime()
    return isNaN(t) ? max : Math.max(max, t)
  }, 0)
  const daysSinceReply = lastInAt ? Math.floor((now - lastInAt) / DAY) : null
  // Antwort heute/gestern = 1.0, linear auf 0 bei 14 Tagen Funkstille.
  const answers =
    daysSinceReply === null ? 0 : Math.max(0, 1 - daysSinceReply / 14)
  factors.push({
    key: "answers",
    label: "Antwortet",
    value: answers,
    weight: 50,
    note:
      daysSinceReply === null
        ? "noch keine Antwort"
        : daysSinceReply === 0
          ? "heute geantwortet"
          : `letzte Antwort vor ${daysSinceReply}d`,
  })

  // Treffen-bereit: Pipeline-Stage.
  const ready = MEETING_READY.includes(contact.pipeline_stage)
    ? 1
    : INTEREST.includes(contact.pipeline_stage)
      ? 0.5
      : 0
  factors.push({
    key: "meeting",
    label: "Treffen-bereit",
    value: ready,
    weight: 30,
    note: ready === 1 ? "Date-Phase" : ready === 0.5 ? "Interesse sichtbar" : "noch nicht",
  })

  // Wien: wohnt die Person in Wien?
  const loc = (contact.location ?? "").toLowerCase()
  const inVienna = loc.includes("wien") || loc.includes("vienna")
  factors.push({
    key: "vienna",
    label: "In Wien",
    value: inVienna ? 1 : 0,
    weight: 20,
    note: contact.location ? contact.location : "Ort unbekannt",
  })

  let raw = factors.reduce((sum, f) => sum + f.value * f.weight, 0)
  if (contact.archived || contact.pipeline_stage === "archived") raw = 0

  const score = Math.round(raw)
  return { score, label: scoreLabel(score), color: matchColor(score), factors }
}

export function scoreLabel(score: number): string {
  if (score >= 75) return "🔥 heiß"
  if (score >= 55) return "warm"
  if (score >= 35) return "lau"
  if (score >= 15) return "kühl"
  return "kalt"
}

export function matchColor(score: number): string {
  if (score >= 75) return "bg-rose-500"
  if (score >= 55) return "bg-orange-500"
  if (score >= 35) return "bg-amber-500"
  if (score >= 15) return "bg-sky-600"
  return "bg-zinc-600"
}
