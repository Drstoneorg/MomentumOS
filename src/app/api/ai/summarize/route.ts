import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { loadContactContext } from "@/lib/ai/context"
import { summarizeConversation } from "@/lib/ai/summarize"

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { contactId } = await req.json()
  const ctx = await loadContactContext(contactId)
  if (!ctx) return NextResponse.json({ error: "contact not found" }, { status: 404 })

  try {
    const result = await summarizeConversation(ctx)
    await supabase.from("conversation_summaries").insert({
      contact_id: contactId,
      summary: result.summary,
    })
    if (result.memories.length) {
      await supabase.from("memories").insert(
        result.memories.map((m) => ({ contact_id: contactId, ...m }))
      )
    }
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI-Fehler" },
      { status: 500 }
    )
  }
}
