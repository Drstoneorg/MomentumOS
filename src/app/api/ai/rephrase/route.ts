import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { loadContactContext } from "@/lib/ai/context"
import { rephraseInMyStyle } from "@/lib/ai/rephrase"

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { contactId, idea } = await req.json()
  if (!idea?.trim()) {
    return NextResponse.json({ error: "Idee fehlt" }, { status: 400 })
  }
  const ctx = await loadContactContext(contactId)
  if (!ctx) return NextResponse.json({ error: "contact not found" }, { status: 404 })

  try {
    const result = await rephraseInMyStyle(ctx, idea.trim())
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI-Fehler" },
      { status: 500 }
    )
  }
}
