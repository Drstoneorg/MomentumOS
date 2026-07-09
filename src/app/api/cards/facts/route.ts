import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cardSafeFacts } from "@/lib/ai/cardFacts"

/** Liefert die Whitelist-Fakten eines Kontakts für den Karten-Builder. */
export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const contactId = new URL(req.url).searchParams.get("contactId")
  if (!contactId) return NextResponse.json({ error: "contactId fehlt" }, { status: 400 })

  const [{ data: contact }, { data: memories }] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", contactId).single(),
    supabase.from("memories").select("id, kind, content").eq("contact_id", contactId),
  ])
  if (!contact) return NextResponse.json({ error: "Kontakt nicht gefunden" }, { status: 404 })

  return NextResponse.json({ facts: cardSafeFacts(contact, memories ?? []) })
}
