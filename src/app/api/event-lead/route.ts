import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimitOk } from "@/lib/rateLimit"

/**
 * „Will kommen"-Einlauf der öffentlichen Event-Seite /e/[slug]: legt einen
 * Kontakt (Event-Lead) plus eine Einladung mit Status lead an. Kein Login —
 * der Slug muss existieren, Honeypot schluckt Bots, Einwilligung ist Pflicht.
 * Es wird NICHTS automatisch verschickt: der Lead taucht im Assistenten auf
 * und du entscheidest, wer eine echte Einladung bekommt.
 */

export const maxDuration = 15

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 })
  }

  // Honeypot gefüllt: höflich ok sagen, nichts speichern
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true })
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : ""
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : ""
  const kontakt = typeof body.kontakt === "string" ? body.kontakt.trim().slice(0, 120) : ""
  if (!/^[a-z0-9-]{1,60}$/.test(slug) || !name || !kontakt || body.consent !== true) {
    return NextResponse.json({ error: "Name, Kontakt und Einwilligung nötig" }, { status: 400 })
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "?").split(",")[0].trim()
  try {
    const [ipOk, globalOk] = await Promise.all([
      rateLimitOk(`event-lead:${ip}`, 10),
      rateLimitOk("event-lead:gesamt", 60),
    ])
    if (!ipOk || !globalOk) {
      return NextResponse.json({ error: "Zu viele Anfragen, bitte später" }, { status: 429 })
    }
  } catch {
    // Zähler defekt: Slug bleibt die Hürde
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: "Server nicht konfiguriert" }, { status: 500 })
  }

  const { data: event } = await admin
    .from("events")
    .select("id, title")
    .eq("public_slug", slug)
    .maybeSingle()
  if (!event) return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 })

  const { data: contact, error: cErr } = await admin
    .from("contacts")
    .insert({
      name,
      platform: "event_page",
      realm: "match",
      intent: "event_lead",
      pipeline_stage: "chatting",
      notes: `Will zu „${event.title}" kommen (über /e/${slug}) · Kontakt: ${kontakt}`,
    })
    .select("id")
    .single()
  if (cErr || !contact) {
    return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 })
  }

  await admin
    .from("event_invites")
    .insert({ event_id: event.id, contact_id: contact.id, status: "lead" })
    .then(() => {})

  return NextResponse.json({ ok: true })
}
