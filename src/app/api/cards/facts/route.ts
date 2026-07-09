import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cardSafeFacts } from "@/lib/ai/cardFacts"
import { datingScore, type ScoreMessage } from "@/lib/scoring"

/** Liefert die Whitelist-Fakten eines Kontakts für den Karten-Builder. */
export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const contactId = new URL(req.url).searchParams.get("contactId")
  if (!contactId) return NextResponse.json({ error: "contactId fehlt" }, { status: 400 })

  const [{ data: contact }, { data: memories }, { data: messages }] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", contactId).single(),
    supabase.from("memories").select("id, kind, content").eq("contact_id", contactId),
    supabase
      .from("messages")
      .select("direction, sent_at")
      .eq("contact_id", contactId)
      .order("sent_at", { ascending: true })
      .limit(200),
  ])
  if (!contact) return NextResponse.json({ error: "Kontakt nicht gefunden" }, { status: 404 })

  const score = datingScore((messages ?? []) as ScoreMessage[], contact).score
  return NextResponse.json({ facts: cardSafeFacts(contact, memories ?? [], score) })
}
