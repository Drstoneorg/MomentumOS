import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimitOk } from "@/lib/rateLimit"

/**
 * Nimmt Fehlermeldungen des ErrorReporter entgegen. Bewusst ohne Login nutzbar
 * (Fehler passieren auch vor dem Login) — dafür Rate-Limit pro IP und global
 * plus harte Längen-Kappung, damit der Endpunkt kein Müllabladeplatz wird.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültig" }, { status: 400 })
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : ""
  if (!message) return NextResponse.json({ error: "message fehlt" }, { status: 400 })

  const ip = (req.headers.get("x-forwarded-for") ?? "unbekannt").split(",")[0].trim()
  const [ipOk, globalOk] = await Promise.all([
    rateLimitOk(`errors:${ip}`, 20),
    rateLimitOk("errors:gesamt", 60),
  ])
  if (!ipOk || !globalOk) return NextResponse.json({ ok: true }) // still schlucken

  const admin = createAdminClient()
  await admin.from("client_errors").insert({
    message,
    stack: typeof body.stack === "string" ? body.stack.slice(0, 4000) : null,
    path: typeof body.path === "string" ? body.path.slice(0, 200) : null,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 200) || null,
    source: "client",
  })
  return NextResponse.json({ ok: true })
}
