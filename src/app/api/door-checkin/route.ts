import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimitOk } from "@/lib/rateLimit"

/**
 * Check-in über den Türsteher-Link /tuer/[token]: eine zweite Person macht
 * Einlass, ohne Login und ohne sonst irgendwas zu sehen. Auth ist der
 * door_token des Events (32 Hex, unique, in der URL). Schreibt ausschließlich
 * den Status der EINEN Einladung dieses Events; Nachbereitung läuft ohne
 * KI-Entwurf (kein Modellaufruf von außen antriggerbar).
 */

export const maxDuration = 15

export async function POST(req: Request) {
  let body: { door_token?: unknown; invite_id?: unknown; undo?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 })
  }

  const token = typeof body.door_token === "string" ? body.door_token.trim() : ""
  const inviteId = typeof body.invite_id === "string" ? body.invite_id.trim() : ""
  const undo = body.undo === true
  if (!/^[a-f0-9]{32}$/.test(token) || !/^[0-9a-f-]{36}$/.test(inviteId)) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 })
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "?").split(",")[0].trim()
  try {
    if (!(await rateLimitOk(`tuer:${ip}`, 200))) {
      return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 })
    }
  } catch {
    // Zähler defekt blockiert den Einlass nicht — Token bleibt die Hürde
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: "Server nicht konfiguriert" }, { status: 500 })
  }

  const { data: event } = await admin
    .from("events")
    .select("id")
    .eq("door_token", token)
    .maybeSingle()
  if (!event) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })

  const { data: invite } = await admin
    .from("event_invites")
    .select("id, status")
    .eq("id", inviteId)
    .eq("event_id", event.id)
    .maybeSingle()
  if (!invite || !["yes", "ticket", "attended"].includes(invite.status)) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })
  }

  const neuerStatus = undo ? (invite.status === "attended" ? "yes" : invite.status) : "attended"
  const { error } = await admin
    .from("event_invites")
    .update({ status: neuerStatus })
    .eq("id", invite.id)
  if (error) return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 })

  if (!undo && invite.status !== "attended") {
    try {
      const { eventNachbereitung } = await import("@/lib/eventNachbereitung")
      await eventNachbereitung(admin, invite.id, event.id, { mitEntwurf: false })
    } catch {
      // Nachbereitung optional — Check-in zählt
    }
  }

  return NextResponse.json({ ok: true, status: neuerStatus })
}
