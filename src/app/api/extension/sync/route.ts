import { NextResponse } from "next/server"
import { authExtension } from "@/lib/extensionAuth"
import { extractProfile } from "@/lib/ai/extractProfile"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

/**
 * Nimmt rohen Seitentext von der Browser-Extension, extrahiert Profil + Chat,
 * legt Kontakt an oder aktualisiert ihn (Matching über platform+external_id).
 */
export async function POST(req: Request) {
  const supabase = await authExtension(req)
  if (!supabase) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: cors })
  }

  const { raw, platform, externalId } = await req.json()
  if (!raw || typeof raw !== "string" || raw.trim().length < 5) {
    return NextResponse.json({ error: "Kein Text" }, { status: 400, headers: cors })
  }

  try {
    const p = await extractProfile(raw, platform ?? "")
    const extId = externalId || p.name.toLowerCase().replace(/\s+/g, "-")

    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("platform", p.platform)
      .eq("external_id", extId)
      .maybeSingle()

    let contactId: string
    if (existing) {
      contactId = existing.id
      await supabase
        .from("contacts")
        .update({
          bio: p.bio ?? undefined,
          interests: p.interests.length ? p.interests : undefined,
          location: p.location ?? undefined,
          age: p.age ?? undefined,
        })
        .eq("id", contactId)
    } else {
      const { data: created, error } = await supabase
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
          external_id: extId,
          pipeline_stage: p.messages.length ? "chatting" : "new_match",
        })
        .select("id")
        .single()
      if (error || !created) throw new Error(error?.message ?? "Insert fehlgeschlagen")
      contactId = created.id
    }

    // Nur neue Nachrichten anhängen (naive Dedupe: content+direction gegen letzte 50)
    if (p.messages.length) {
      const { data: recent } = await supabase
        .from("messages")
        .select("direction, content")
        .eq("contact_id", contactId)
        .order("sent_at", { ascending: false })
        .limit(50)
      const seen = new Set((recent ?? []).map((m) => `${m.direction}|${m.content}`))
      const fresh = p.messages.filter((m) => !seen.has(`${m.direction}|${m.content}`))
      if (fresh.length) {
        const base = Date.now() - fresh.length * 1000
        await supabase.from("messages").insert(
          fresh.map((m, i) => ({
            contact_id: contactId,
            direction: m.direction,
            channel: "dating_app",
            content: m.content,
            source: "import" as const,
            sent_at: new Date(base + i * 1000).toISOString(),
          }))
        )
      }
    }
    if (p.memories.length && !existing) {
      await supabase.from("memories").insert(
        p.memories.map((m) => ({ contact_id: contactId, ...m }))
      )
    }

    return NextResponse.json(
      { contactId, name: p.name, isNew: !existing, messageCount: p.messages.length },
      { headers: cors }
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync-Fehler" },
      { status: 500, headers: cors }
    )
  }
}
