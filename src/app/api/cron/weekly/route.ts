import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushToAll } from "@/lib/push"
import { sendTelegramBot } from "@/lib/telegramBot"
import { beatCron, cronAuthError } from "@/lib/cronHeartbeat"
import { outcomeStats } from "@/lib/outcomes"
import { monthlyUsage } from "@/lib/ai/usage"

export const maxDuration = 30

/**
 * Wochen-Digest (Sonntagabend): eine Nachricht mit allem, was zählt —
 * Funnel-Zahlen, Antwortquote, Jobs, Kosten, offene Entscheidungen.
 * Versand an MICH via Telegram-Bot (Einstellungen), sonst Web-Push.
 * Sendet nichts an Kontakte.
 */
export async function GET(req: Request) {
  const denied = cronAuthError(req)
  if (denied) return denied

  const supabase = createAdminClient()
  await beatCron(supabase, "weekly")
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString()
  const nowIso = new Date().toISOString()

  const [
    { count: newMatches },
    { data: weekMsgs },
    { count: dueFollowups },
    { count: openDrafts },
    { data: nextEvent },
    { count: jobsApplied },
    { count: jobsInterview },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("realm", "match")
      .gte("created_at", weekAgo),
    supabase.from("messages").select("direction").gte("sent_at", weekAgo),
    supabase
      .from("followups")
      .select("id", { count: "exact", head: true })
      .eq("done", false)
      .lte("due_at", nowIso),
    supabase
      .from("suggestions")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
    supabase
      .from("events")
      .select("id, title, starts_at, event_invites(status)")
      .gte("starts_at", nowIso)
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("job_applications")
      .select("id", { count: "exact", head: true })
      .gte("applied_at", weekAgo),
    supabase
      .from("job_applications")
      .select("id", { count: "exact", head: true })
      .eq("stage", "interview"),
  ])

  const sentOut = (weekMsgs ?? []).filter((m) => m.direction === "out").length
  const gotIn = (weekMsgs ?? []).filter((m) => m.direction === "in").length

  let quoteLine = ""
  try {
    const stats = await outcomeStats(supabase)
    if (stats.totalSent >= 5) {
      const best = stats.byStyle.filter((s) => s.sent >= 3)[0]
      quoteLine = best
        ? `Bester Stil: ${best.style} (${Math.round(best.rate * 100)}% Antwortquote)`
        : ""
    }
  } catch {
    // Messung optional
  }

  let costLine = ""
  try {
    const usage = await monthlyUsage(supabase)
    costLine = `KI-Kosten Monat: $${usage.monthCostUsd.toFixed(2)} von $${usage.limitUsd.toFixed(2)}`
  } catch {
    // Kosten optional
  }

  const invites = nextEvent?.event_invites ?? []
  const funnelLine = nextEvent
    ? `🎟 ${nextEvent.title}: ${invites.length} eingeladen, ${
        invites.filter((i) => ["yes", "ticket", "attended"].includes(i.status)).length
      } zugesagt, ${invites.filter((i) => ["ticket", "attended"].includes(i.status)).length} Tickets`
    : null

  const lines = [
    "📊 <b>MatchOS Wochen-Digest</b>",
    "",
    `💘 ${newMatches ?? 0} neue Matches · ${sentOut} gesendet · ${gotIn} Antworten erhalten`,
    quoteLine || null,
    funnelLine,
    `💼 ${jobsApplied ?? 0} Bewerbungen diese Woche · ${jobsInterview ?? 0} im Interview`,
    costLine || null,
    "",
    `Offen: ${dueFollowups ?? 0} Follow-ups fällig · ${openDrafts ?? 0} Entwürfe in der Queue`,
    "https://matchos-ten.vercel.app",
  ].filter((l): l is string => l !== null)

  const text = lines.join("\n")
  const viaTelegram = await sendTelegramBot(supabase, text)
  if (!viaTelegram) {
    await sendPushToAll({
      title: "MatchOS — Wochen-Digest",
      body: `${newMatches ?? 0} neue Matches, ${gotIn} Antworten, ${dueFollowups ?? 0} Follow-ups fällig`,
      url: "/",
    }).catch(() => {})
  }

  return NextResponse.json({
    sent: viaTelegram ? "telegram" : "push",
    newMatches: newMatches ?? 0,
    sentOut,
    gotIn,
  })
}
