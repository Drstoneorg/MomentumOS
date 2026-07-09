import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { learnStyle } from "@/lib/ai/learnStyle"

// Baut das Stilprofil aus echten eigenen Nachrichten:
// alle direction=out aus der DB + optional per Export hochgeladene Nachrichten.
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { imported } = (await req.json().catch(() => ({}))) as {
    imported?: string[]
  }

  const { data: sent } = await supabase
    .from("messages")
    .select("content")
    .eq("direction", "out")
    .order("sent_at", { ascending: true })
    .limit(500)

  const own = [
    ...(sent ?? []).map((m) => m.content),
    ...(Array.isArray(imported) ? imported.map(String) : []),
  ]

  try {
    const learned = await learnStyle(own)
    await supabase
      .from("settings")
      .upsert({ key: "learned_style", value: learned })
    return NextResponse.json({
      ...learned,
      sourceCount: own.length,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI-Fehler" },
      { status: 400 }
    )
  }
}

// Gelerntes Profil löschen
export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  await supabase.from("settings").delete().eq("key", "learned_style")
  return NextResponse.json({ ok: true })
}
