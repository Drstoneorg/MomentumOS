import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { loadContactContext } from "@/lib/ai/context"
import { generateReplies } from "@/lib/ai/generateReplies"

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { contactId, situation, channel } = await req.json()
  const ctx = await loadContactContext(contactId)
  if (!ctx) return NextResponse.json({ error: "contact not found" }, { status: 404 })

  try {
    const result = await generateReplies(ctx, situation ?? "")
    const { data: suggestion } = await supabase
      .from("suggestions")
      .insert({
        contact_id: contactId,
        situation: situation ?? null,
        variants: result.variants,
        channel: channel ?? "manual",
        status: "draft",
      })
      .select()
      .single()
    return NextResponse.json({ ...result, suggestionId: suggestion?.id })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI-Fehler" },
      { status: 500 }
    )
  }
}
