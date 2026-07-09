import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Daumen hoch/runter für einen Antwortvorschlag — fließt als
// Positiv-/Anti-Beispiel in künftige Generierungen ein (context.ts).
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { contactId, style, text, rating } = await req.json()
  if (!text || (rating !== 1 && rating !== -1)) {
    return NextResponse.json({ error: "text + rating (1|-1) nötig" }, { status: 400 })
  }

  const { error } = await supabase.from("reply_feedback").insert({
    contact_id: contactId ?? null,
    style: style ?? null,
    content: String(text),
    rating,
    source: "app",
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
