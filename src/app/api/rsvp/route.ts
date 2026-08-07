import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimitOk } from "@/lib/rateLimit"

/**
 * Öffentliche Zusage/Absage über den persönlichen Einladungs-Link.
 * Auth ist der rsvp_token selbst (32 Hex, unique, pro Einladung) — kein Login,
 * kein Cookie. Schreibt ausschließlich status und plus_ones der EINEN Einladung.
 * Tabelle bleibt für anon zu; der Weg hier läuft über den Service-Role-Client.
 */

export const maxDuration = 15

export async function POST(req: Request) {
  let body: { token?: unknown; antwort?: unknown; plus_ones?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 })
  }

  const token = typeof body.token === "string" ? body.token.trim() : ""
  const antwort = body.antwort === "ja" ? "yes" : body.antwort === "nein" ? "no" : null
  if (!/^[a-f0-9]{32}$/.test(token) || !antwort) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 })
  }
  const plusOnes =
    antwort === "yes" && typeof body.plus_ones === "number"
      ? Math.min(3, Math.max(0, Math.round(body.plus_ones)))
      : 0

  const ip = (req.headers.get("x-forwarded-for") ?? "?").split(",")[0].trim()
  try {
    const [ipOk, globalOk] = await Promise.all([
      rateLimitOk(`rsvp:${ip}`, 20),
      rateLimitOk("rsvp:gesamt", 120),
    ])
    if (!ipOk || !globalOk) {
      return NextResponse.json({ error: "Zu viele Anfragen, bitte später" }, { status: 429 })
    }
  } catch {
    // Limit-Zähler defekt blockiert keine Zusage — Token bleibt die Hürde
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: "Server nicht konfiguriert" }, { status: 500 })
  }

  const { data: invite } = await admin
    .from("event_invites")
    .select("id, status")
    .eq("rsvp_token", token)
    .maybeSingle()
  if (!invite) return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 })

  // Ticket gekauft oder schon da gewesen: Status ist final, nur Begleitung änderbar
  const statusFinal = ["ticket", "attended"].includes(invite.status)
  const { error } = await admin
    .from("event_invites")
    .update(statusFinal ? { plus_ones: plusOnes } : { status: antwort, plus_ones: plusOnes })
    .eq("id", invite.id)
  if (error) return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 })

  return NextResponse.json({ ok: true, status: statusFinal ? invite.status : antwort })
}
