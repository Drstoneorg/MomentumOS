import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractProfile } from "@/lib/ai/extractProfile"
import { splitChatBlock } from "@/lib/chatParse"

// Parst Freitext in Kontaktfelder — legt NICHTS an, liefert nur Vorschläge fürs Formular.
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { raw } = await req.json()
  if (!raw || typeof raw !== "string" || raw.trim().length < 3) {
    return NextResponse.json({ error: "Kein Text" }, { status: 400 })
  }

  try {
    // Nur Kontaktfelder gefragt — Chatblock vorher abtrennen spart LLM-Tokens
    const { profile } = splitChatBlock(raw)
    const p = await extractProfile(profile || raw, "")
    return NextResponse.json({
      name: p.name,
      age: p.age,
      location: p.location,
      language: p.language,
      platform: p.platform,
      bio: p.bio,
      interests: p.interests,
      notes: p.notes,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Parse-Fehler" },
      { status: 500 }
    )
  }
}
