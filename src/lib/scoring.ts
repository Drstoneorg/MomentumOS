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

// Stil-Signale fuer die Date-Spur: alternative / aesthetic / goth.
// Kurze Woerter mit Wortgrenze, sonst matcht "alt" jedes "verhalten".
const STYLE_PATTERNS: [RegExp, string][] = [
  [/goth/i, "goth"],
  [/\balt\b/i, "alt"],
  [/alternativ/i, "alternativ"],
  [/aesthetic|ästhet/i, "aesthetic"],
  [/\bemo\b/i, "emo"],
  [/\bpunk/i, "punk"],
  [/grunge/i, "grunge"],
  [/\bdark\b/i, "dark"],
  [/tattoo|tätowier/i, "tattoo"],
  [/piercing/i, "piercing"],
  [/\bmetal\b/i, "metal"],
  [/witch/i, "witchy"],
  [/cyber/i, "cyber"],
  [/\brave\b|raver/i, "rave"],
  [/techno/i, "techno"],
]

export type StyleFields = {
  interests?: string[] | null
  bio?: string | null
  notes?: string | null
  photo_notes?: string | null
  relationship_tags?: string[] | null
}

/** Welche Alt/Goth/Aesthetic-Signale stecken in Profilfeldern? */
export function styleSignals(c: StyleFields): string[] {
  const haystack = [
    ...(c.interests ?? []),
    ...(c.relationship_tags ?? []),
    c.bio ?? "",
    c.notes ?? "",
    c.photo_notes ?? "",
  ].join(" · ")
  return STYLE_PATTERNS.filter(([re]) => re.test(haystack)).map(([, label]) => label)
}

/**
 * Intent-Vorschlag für NEUE Match-Kontakte: Stil passt (alt/goth/aesthetic) = Date-Spur.
 * Profildaten vorhanden, aber kein Stil-Signal = Kandidatin für den Event-Funnel.
 * Ohne Daten kein Urteil (bleibt date, manuell umstellbar).
 */
export function suggestIntent(c: StyleFields): "date" | "event_lead" {
  const hasData = (c.interests?.length ?? 0) > 0 || !!c.bio || !!c.photo_notes || !!c.notes
  if (!hasData) return "date"
  return styleSignals(c).length ? "date" : "event_lead"
}

/**
 * Vier Faktoren:
 * - Antwortet (40): schreibt die Person zurueck, und wie frisch ist die letzte Antwort.
 * - Treffen-bereit (25): Pipeline-Stage Richtung Date (Interesse = halbe Punkte).
 * - Stil (20): alternative / aesthetic / goth-Signale in Interessen, Bio, Notizen.
 * - Wien (15): wohnt in Wien (Ort enthaelt "wien" oder "vienna").
 */
export function datingScore(
  messages: ScoreMessage[],
  contact: {
    pipeline_stage: Enums<"pipeline_stage">
    archived?: boolean
    location?: string | null
  } & StyleFields,
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
    weight: 40,
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
    weight: 25,
    note: ready === 1 ? "Date-Phase" : ready === 0.5 ? "Interesse sichtbar" : "noch nicht",
  })

  // Stil: alternative / aesthetic / goth-Signale (mein Beuteschema fuer die Date-Spur).
  const signals = styleSignals(contact)
  factors.push({
    key: "style",
    label: "Stil passt",
    value: signals.length ? 1 : 0,
    weight: 20,
    note: signals.length ? signals.slice(0, 4).join(", ") : "kein Alt/Goth/Aesthetic-Signal",
  })

  // Wien: wohnt die Person in Wien?
  const loc = (contact.location ?? "").toLowerCase()
  const inVienna = loc.includes("wien") || loc.includes("vienna")
  factors.push({
    key: "vienna",
    label: "In Wien",
    value: inVienna ? 1 : 0,
    weight: 15,
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
