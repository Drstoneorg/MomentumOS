import type { Enums } from "@/lib/database.types"

/**
 * Match-Score (0–100) für Dating-Kontakte. Misst, wie „warm" ein Chat läuft —
 * unabhängig vom Verbindungs-Score aus moments.ts (der Freundschaftspflege misst).
 *
 * Rein, testbar, ohne DB. Braucht nur Nachrichten-Metadaten + Pipeline-Stage.
 */

export type ScoreMessage = { direction: "in" | "out"; sent_at: string }

const STAGE_ORDER: Enums<"pipeline_stage">[] = [
  "new_match",
  "first_message_pending",
  "chatting",
  "interest_visible",
  "platform_switch",
  "on_messenger",
  "date_idea",
  "date_proposed",
  "scheduling",
  "date_planned",
  "calendar_created",
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
 * Gewichtete Faktoren:
 * - Momentum (30): Fortschritt in der Pipeline Richtung Date.
 * - Erwiderung (25): antwortet die Person überhaupt (Anteil eingehender Nachrichten).
 * - Aktualität (20): wie frisch die letzte Nachricht ist.
 * - Tempo (15): antwortet sie schnell nach deinen Nachrichten.
 * - Substanz (10): Chat-Umfang (Engagement, gedeckelt).
 */
export function datingScore(
  messages: ScoreMessage[],
  contact: { pipeline_stage: Enums<"pipeline_stage">; archived?: boolean },
  now = Date.now()
): MatchScore {
  const factors: ScoreFactor[] = []

  // Momentum
  const stageIdx = STAGE_ORDER.indexOf(contact.pipeline_stage)
  const momentum = stageIdx < 0 ? 0 : stageIdx / (STAGE_ORDER.length - 1)
  factors.push({
    key: "momentum",
    label: "Momentum",
    value: momentum,
    weight: 30,
    note: `Stufe ${Math.max(stageIdx, 0) + 1}/${STAGE_ORDER.length}`,
  })

  const inbound = messages.filter((m) => m.direction === "in").length
  const outbound = messages.filter((m) => m.direction === "out").length
  const total = inbound + outbound

  // Erwiderung: Anteil eingehender Nachrichten. ~50 % ist ideal (Balance).
  // Score fällt, wenn du fast nur sendest (Person antwortet kaum).
  const inboundShare = total ? inbound / total : 0
  const reciprocity = total === 0 ? 0 : Math.min(1, inboundShare / 0.5)
  factors.push({
    key: "reciprocity",
    label: "Erwiderung",
    value: reciprocity,
    weight: 25,
    note: total ? `${inbound}↓ / ${outbound}↑` : "keine Nachrichten",
  })

  // Aktualität: Tage seit letzter Nachricht (egal welche Richtung).
  const lastAt = messages.reduce<number>((max, m) => {
    const t = new Date(m.sent_at).getTime()
    return isNaN(t) ? max : Math.max(max, t)
  }, 0)
  const daysSince = lastAt ? Math.floor((now - lastAt) / DAY) : null
  // 0 Tage = 1.0, linear auf 0 bei 14 Tagen.
  const recency = daysSince === null ? 0 : Math.max(0, 1 - daysSince / 14)
  factors.push({
    key: "recency",
    label: "Aktualität",
    value: recency,
    weight: 20,
    note: daysSince === null ? "—" : daysSince === 0 ? "heute" : `vor ${daysSince}d`,
  })

  // Tempo: mittlere Antwortzeit der Person auf deine Nachrichten (in→nach out).
  const sorted = [...messages]
    .map((m) => ({ dir: m.direction, t: new Date(m.sent_at).getTime() }))
    .filter((m) => !isNaN(m.t))
    .sort((a, b) => a.t - b.t)
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].dir === "out" && sorted[i].dir === "in") {
      gaps.push(sorted[i].t - sorted[i - 1].t)
    }
  }
  const avgReplyH = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length / 3_600_000 : null
  // < 1 h = 1.0, linear auf 0 bei 48 h.
  const tempo = avgReplyH === null ? 0 : Math.max(0, Math.min(1, 1 - (avgReplyH - 1) / 47))
  factors.push({
    key: "tempo",
    label: "Antworttempo",
    value: tempo,
    weight: 15,
    note: avgReplyH === null ? "—" : avgReplyH < 1 ? "< 1 h" : `~${Math.round(avgReplyH)} h`,
  })

  // Substanz: Chat-Umfang, gedeckelt bei 20 Nachrichten.
  const volume = Math.min(1, total / 20)
  factors.push({
    key: "volume",
    label: "Substanz",
    value: volume,
    weight: 10,
    note: `${total} Nachrichten`,
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
