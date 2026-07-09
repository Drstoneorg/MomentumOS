import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Gibt einen Vorschlag als Telegram-Nachricht frei: setzt chosen_variant,
 * channel=telegram, status=approved — der Worker sendet. Kein Direktversand
 * ohne diesen expliziten Klick (assist-not-act).
 * Body: { suggestionId, style }
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { suggestionId, style } = await req.json()
  if (!suggestionId || !style) {
    return NextResponse.json({ error: "suggestionId und style nötig" }, { status: 400 })
  }

  const { data: suggestion } = await supabase
    .from("suggestions")
    .select("id, contact_id, variants")
    .eq("id", suggestionId)
    .single()
  if (!suggestion) return NextResponse.json({ error: "Vorschlag nicht gefunden" }, { status: 404 })

  const variants = (suggestion.variants ?? {}) as Record<string, string>
  if (!variants[style]) {
    return NextResponse.json({ error: "Stil nicht im Vorschlag" }, { status: 400 })
  }

  const { data: tg } = await supabase
    .from("contact_channels")
    .select("handle")
    .eq("contact_id", suggestion.contact_id)
    .eq("channel", "telegram")
    .limit(1)
    .maybeSingle()
  if (!tg?.handle) {
    return NextResponse.json(
      { error: "Kein Telegram-Handle beim Kontakt — nur Kopieren möglich." },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from("suggestions")
    .update({ chosen_variant: style, channel: "telegram", status: "approved" })
    .eq("id", suggestionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
