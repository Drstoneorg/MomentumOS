import { NextResponse } from "next/server"
import { authExtension } from "@/lib/extensionAuth"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

type ActivityEvent = { kind: "dm" | "like" | "mention" | "other"; name: string; text?: string }

/**
 * Social-Activity-Tracker (Instagram & Co.): Extension meldet beim Browsen
 * gesehene Ereignisse (ungelesene DM, Like, Story-Reaktion, Erwähnung).
 * Bekannte Kontakte bekommen ein fälliges Follow-up mit Ereignis-Grund —
 * Dashboard zeigt es in „Heute dran", ⚡ generiert die passende Reaktion.
 * Nur Lesen + Erinnern. Gesendet wird nie automatisch.
 */
export async function POST(req: Request) {
  const supabase = await authExtension(req)
  if (supabase === "rate_limited") {
    return NextResponse.json({ error: "Rate-Limit erreicht — in einer Stunde wieder" }, { status: 429, headers: cors })
  }
  if (!supabase) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: cors })
  }

  const { events, platform } = (await req.json()) as {
    events: ActivityEvent[]
    platform?: string
  }
  if (!Array.isArray(events) || !events.length) {
    return NextResponse.json({ error: "Keine Events" }, { status: 400, headers: cors })
  }

  const KIND_LABEL: Record<ActivityEvent["kind"], string> = {
    dm: "neue Nachricht",
    like: "hat geliked",
    mention: "hat dich erwähnt",
    other: "Aktivität",
  }

  let created = 0
  let matched = 0
  const unmatched: string[] = []

  for (const ev of events.slice(0, 30)) {
    const name = (ev.name || "").trim()
    if (name.length < 2 || name.length > 60) continue

    const { data: contact } = await supabase
      .from("contacts")
      .select("id, name")
      .ilike("name", `${name}%`)
      .neq("pipeline_stage", "archived")
      .limit(1)
      .maybeSingle()
    if (!contact) {
      unmatched.push(name)
      continue
    }
    matched++

    const reason = `📸 ${platform === "instagram" ? "IG" : platform || "Social"}: ${
      KIND_LABEL[ev.kind] ?? "Aktivität"
    }${ev.text ? ` — „${ev.text.slice(0, 120)}"` : ""}`

    // Dedupe: gleiches offenes Follow-up in den letzten 48h nicht doppeln.
    const since = new Date(Date.now() - 48 * 3600_000).toISOString()
    const { data: existing } = await supabase
      .from("followups")
      .select("id")
      .eq("contact_id", contact.id)
      .eq("done", false)
      .eq("reason", reason)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle()
    if (existing) continue

    await supabase.from("followups").insert({
      contact_id: contact.id,
      due_at: new Date().toISOString(),
      reason,
    })
    created++
  }

  return NextResponse.json({ matched, created, unmatched: unmatched.slice(0, 10) }, { headers: cors })
}
