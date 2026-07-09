import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { daysUntilBirthday } from "@/lib/moments"
import { sendPushToAll } from "@/lib/push"

export const maxDuration = 30

const STALE_DAYS = 3

/**
 * Morgen-Digest: zählt fällige Follow-ups, eingeschlafene Chats und heutige
 * Geburtstage, schickt EINE Push mit Link aufs Dashboard („Heute dran"-Box).
 * Erzeugt nichts, sendet keine Nachrichten — reine Tagesübersicht.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const [{ data: followups }, { data: contacts }, { data: lastMsgs }] = await Promise.all([
    supabase.from("followups").select("id").eq("done", false).lte("due_at", now),
    supabase.from("contacts").select("id, birthday, pipeline_stage").neq("pipeline_stage", "archived"),
    supabase.from("messages").select("contact_id, sent_at").order("sent_at", { ascending: false }),
  ])

  const lastByContact = new Map<string, string>()
  for (const m of lastMsgs ?? []) {
    if (!lastByContact.has(m.contact_id)) lastByContact.set(m.contact_id, m.sent_at)
  }
  const staleCutoff = Date.now() - STALE_DAYS * 86400_000
  const stale = (contacts ?? []).filter((c) => {
    const last = lastByContact.get(c.id)
    return (
      last &&
      new Date(last).getTime() < staleCutoff &&
      ["chatting", "interest_visible", "on_messenger"].includes(c.pipeline_stage)
    )
  }).length

  const birthdays = (contacts ?? []).filter((c) => daysUntilBirthday(c.birthday) === 0).length
  const due = followups?.length ?? 0

  const parts = [
    due ? `${due} Follow-up${due > 1 ? "s" : ""} fällig` : null,
    stale ? `${stale} Chat${stale > 1 ? "s" : ""} eingeschlafen` : null,
    birthdays ? `${birthdays} Geburtstag${birthdays > 1 ? "e" : ""} heute 🎂` : null,
  ].filter(Boolean)

  if (parts.length) {
    await sendPushToAll({
      title: "MatchOS — Heute dran",
      body: parts.join(" · "),
      url: "/",
    }).catch(() => {})
  }

  return NextResponse.json({ due, stale, birthdays, pushed: parts.length > 0 })
}
