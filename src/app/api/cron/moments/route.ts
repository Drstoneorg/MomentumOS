import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { daysUntilBirthday, connectionScore } from "@/lib/moments"

export const maxDuration = 60

/**
 * Täglicher Moments-Scan:
 * - Geburtstage in 0..3 Tagen → Follow-up-Reminder (falls noch keiner offen)
 * - vernachlässigte wichtige Kontakte (overdue, mit Beziehungs-Tag) → Check-in-Reminder
 * Erzeugt nur Reminder (followups), kein Autoversand. MVP-Prinzip.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .neq("pipeline_stage", "archived")

  const results: { contactId: string; reason: string }[] = []

  for (const c of contacts ?? []) {
    let reason: string | null = null
    const bday = daysUntilBirthday(c.birthday)
    if (bday != null && bday <= 3) {
      reason = bday === 0 ? "🎂 Geburtstag heute!" : `🎂 Geburtstag in ${bday} Tagen`
    } else {
      const { overdue, daysSince } = connectionScore(c)
      if (overdue && (c.relationship_tags?.length ?? 0) > 0) {
        reason = `Kontaktpause — ${daysSince ?? "?"} Tage kein Kontakt, mal melden`
      }
    }
    if (!reason) continue

    // Kein doppelter offener Follow-up mit gleichem Grund heute
    const since = new Date(Date.now() - 20 * 3600_000).toISOString()
    const { data: existing } = await supabase
      .from("followups")
      .select("id")
      .eq("contact_id", c.id)
      .eq("done", false)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle()
    if (existing) continue

    await supabase.from("followups").insert({
      contact_id: c.id,
      due_at: new Date().toISOString(),
      reason,
    })
    results.push({ contactId: c.id, reason })
  }

  return NextResponse.json({ scanned: contacts?.length ?? 0, created: results.length, results })
}
