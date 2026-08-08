import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimitOk } from "@/lib/rateLimit"
import { einladungsIcs } from "@/lib/inviteIcs"

/**
 * „In Kalender eintragen" von der öffentlichen Einladungs-Seite: liefert die
 * ICS-Datei zum Event der EINEN Einladung. Auth ist der rsvp_token, wie beim
 * RSVP selbst. Ohne gültigen Token gibt es nichts — auch keine Event-Daten.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? ""
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 })
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "?").split(",")[0].trim()
  try {
    if (!(await rateLimitOk(`ics:${ip}`, 30))) {
      return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 })
    }
  } catch {
    // Zähler defekt blockiert den Kalender-Eintrag nicht
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: "Server nicht konfiguriert" }, { status: 500 })
  }

  const { data: invite } = await admin
    .from("event_invites")
    .select("id, events(id, title, starts_at, location, description)")
    .eq("rsvp_token", token)
    .maybeSingle()
  const event = invite?.events
  if (!event?.starts_at) {
    return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 })
  }

  const ics = einladungsIcs({
    uid: event.id,
    title: event.title,
    starts_at: event.starts_at,
    location: event.location,
    description: event.description,
  })
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="einladung.ics"',
      "Cache-Control": "no-store",
    },
  })
}
