import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { loadContactContext } from "@/lib/ai/context"
import { analyzeStage } from "@/lib/ai/analyzeStage"

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
    const result = await analyzeStage(ctx)
    await supabase
      .from("contacts")
      .update({
        pipeline_stage: result.stage,
        next_step: result.next_step,
        date_idea: result.date_idea ?? ctx.contact.date_idea,
      })
      .eq("id", contactId)
    if (result.followup_in_days != null) {
      const due = new Date()
      due.setDate(due.getDate() + result.followup_in_days)
      await supabase.from("followups").insert({
        contact_id: contactId,
        due_at: due.toISOString(),
        reason: result.followup_reason,
      })
    }
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI-Fehler" },
      { status: 500 }
    )
  }
}
