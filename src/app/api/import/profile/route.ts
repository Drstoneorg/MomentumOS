import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractProfile } from "@/lib/ai/extractProfile"

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { raw, platform } = await req.json()
  if (!raw || typeof raw !== "string" || raw.trim().length < 5) {
    return NextResponse.json({ error: "Kein Text zum Importieren" }, { status: 400 })
  }

  try {
    const p = await extractProfile(raw, platform ?? "")

    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({
        name: p.name,
        age: p.age,
        location: p.location,
        language: p.language,
        platform: p.platform,
        bio: p.bio,
        interests: p.interests,
        notes: p.notes,
        pipeline_stage: p.messages.length ? "chatting" : "new_match",
      })
      .select("id")
      .single()
    if (error || !contact) throw new Error(error?.message ?? "Insert fehlgeschlagen")

    if (p.messages.length) {
      const base = Date.now() - p.messages.length * 1000
      await supabase.from("messages").insert(
        p.messages.map((m, i) => ({
          contact_id: contact.id,
          direction: m.direction,
          channel: "dating_app",
          content: m.content,
          source: "import" as const,
          sent_at: new Date(base + i * 1000).toISOString(),
        }))
      )
    }
    if (p.memories.length) {
      await supabase.from("memories").insert(
        p.memories.map((m) => ({ contact_id: contact.id, ...m }))
      )
    }

    return NextResponse.json({ contactId: contact.id, extracted: p })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import-Fehler" },
      { status: 500 }
    )
  }
}
