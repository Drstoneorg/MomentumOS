import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractProfile } from "@/lib/ai/extractProfile"
import { suggestIntent } from "@/lib/scoring"
import { splitChatBlock, parseChatLines } from "@/lib/chatParse"
import { createOpenerDraft } from "@/lib/ai/openerDraft"

export const maxDuration = 60

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
    // Chatblock deterministisch parsen, LLM nur fürs Profil (siehe chatParse.ts)
    const { profile: profilePart, chat } = splitChatBlock(raw)
    const parsedChat = chat ? parseChatLines(chat) : []
    const p = await extractProfile(
      parsedChat.length ? profilePart || "Kein Profiltext sichtbar" : raw,
      platform ?? ""
    )
    const msgs: { direction: "in" | "out"; content: string; at?: string | null }[] =
      parsedChat.length ? parsedChat : p.messages

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
        pipeline_stage: msgs.length ? "chatting" : "new_match",
        // Auto-Triage: kein Alt/Goth/Aesthetic-Signal im Profil = Event-Lead-Vorschlag
        intent: suggestIntent({ bio: p.bio, interests: p.interests, notes: p.notes }),
      })
      .select("id")
      .single()
    if (error || !contact) throw new Error(error?.message ?? "Insert fehlgeschlagen")

    if (msgs.length) {
      const base = Date.now() - msgs.length * 1000
      await supabase.from("messages").insert(
        msgs.map((m, i) => ({
          contact_id: contact.id,
          direction: m.direction,
          channel: "dating_app",
          content: m.content,
          source: "import" as const,
          // Echter Zeitstempel aus dem Text schlägt die Sekunden-Heuristik
          sent_at: m.at ?? new Date(base + i * 1000).toISOString(),
        }))
      )
    }
    if (p.memories.length) {
      await supabase.from("memories").insert(
        p.memories.map((m) => ({ contact_id: contact.id, ...m }))
      )
    }

    // Profil ohne Chat importiert: Opener-Entwurf direkt bereitlegen
    if (!msgs.length) await createOpenerDraft(supabase, contact.id)

    return NextResponse.json({ contactId: contact.id, extracted: p })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import-Fehler" },
      { status: 500 }
    )
  }
}
