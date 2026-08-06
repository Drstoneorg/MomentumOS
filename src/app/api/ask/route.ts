import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { rateLimitOk } from "@/lib/rateLimit"
import { askStream, type AskEvent, type AskMessage } from "@/lib/ai/ask"

/**
 * Frage-Chat über die eigenen Daten. Der Supabase-Client stammt aus der
 * Nutzersitzung, nicht vom Service-Role-Key — die Werkzeuge sehen also nur,
 * was RLS ohnehin freigibt.
 */

export const maxDuration = 60

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  // Jede Frage kostet mehrere Modellaufrufe — Deckel gegen versehentliche Dauerschleifen.
  // Der Zähler braucht den Service-Role-Key (die rate_limits-Tabelle hat RLS ohne
  // Policy). Fehlt er, etwa lokal, läuft die Frage trotzdem: die Route ist hinter
  // dem Login, und die harte Kostenbremse ist assertBudget() im Modellaufruf.
  try {
    if (!(await rateLimitOk("ask", 60))) {
      return NextResponse.json({ error: "Zu viele Fragen in dieser Stunde. Später nochmal." }, { status: 429 })
    }
  } catch {
    // Zähler nicht verfügbar — kein Grund, die Frage zu blockieren.
  }

  let body: { frage?: unknown; historie?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 })
  }

  const frage = typeof body.frage === "string" ? body.frage.trim() : ""
  if (!frage) return NextResponse.json({ error: "Keine Frage übergeben" }, { status: 400 })
  if (frage.length > 1000) return NextResponse.json({ error: "Frage zu lang" }, { status: 400 })

  const historie: AskMessage[] = Array.isArray(body.historie)
    ? body.historie
        .filter(
          (m): m is AskMessage =>
            !!m &&
            typeof m === "object" &&
            (m as AskMessage).role !== undefined &&
            ["user", "assistant"].includes((m as AskMessage).role) &&
            typeof (m as AskMessage).content === "string"
        )
        .slice(-10)
    : []

  // NDJSON-Stream: status/reset/delta/done-Ereignisse, eine Zeile pro Ereignis.
  // Die Antwort tröpfelt so sofort in den Chat, statt sekundenlang zu stehen.
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const write = (e: AskEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"))
      try {
        await askStream(supabase, frage, historie, write)
      } catch (e) {
        write({ t: "error", text: e instanceof Error ? e.message : String(e) })
      }
      controller.close()
    },
  })
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
