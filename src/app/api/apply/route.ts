import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimitOk } from "@/lib/rateLimit"

/**
 * Einziger öffentlicher Schreibweg von RecruitOS: nimmt Bewerbungen der
 * Landing-Page (/model) entgegen. Schutz: Honeypot-Feld, Pflicht-Einwilligung,
 * Stunden-Rate-Limit pro IP plus globales Limit, harte Längen-Kappung.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 })
  }

  // Honeypot gefüllt = Bot. Bewusst "ok" antworten, damit nichts zu lernen ist.
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true })
  }

  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : ""
  const name = str(body.name, 80)
  const consent = body.consent === true
  const age = body.age_confirmed === true

  if (name.length < 2) return NextResponse.json({ error: "Name fehlt" }, { status: 400 })
  if (!consent || !age) {
    return NextResponse.json(
      { error: "Einwilligung und Altersbestätigung sind Pflicht" },
      { status: 400 }
    )
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "unbekannt").split(",")[0].trim()
  const [ipOk, globalOk] = await Promise.all([
    rateLimitOk(`apply:${ip}`, 5),
    rateLimitOk("apply:gesamt", 30),
  ])
  if (!ipOk || !globalOk) {
    return NextResponse.json(
      { error: "Zu viele Anfragen — bitte später erneut versuchen" },
      { status: 429 }
    )
  }

  const admin = createAdminClient()
  const { error } = await admin.from("recruit_applications").insert({
    name,
    city: str(body.city, 60) || null,
    instagram: str(body.instagram, 80).replace(/^@/, "") || null,
    email: str(body.email, 120) || null,
    style: str(body.style, 120) || null,
    message: str(body.message, 1000) || null,
    consent,
    age_confirmed: age,
  })
  if (error) {
    return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
