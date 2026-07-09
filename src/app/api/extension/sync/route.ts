import { NextResponse } from "next/server"
import { authExtension } from "@/lib/extensionAuth"
import { extractProfile } from "@/lib/ai/extractProfile"
import { loadContactContext } from "@/lib/ai/context"
import { summarizeConversation } from "@/lib/ai/summarize"
import { analyzeStage } from "@/lib/ai/analyzeStage"
import { generateReplies, type ReplyVariants } from "@/lib/ai/generateReplies"

export const maxDuration = 60

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

  const { raw, platform, externalId, nowLocal } = await req.json()
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

    // Auto-Pipeline: Zusammenfassung + Stage-Analyse + Sofort-Entwurf,
    // wenn ein Chatverlauf dabei war. Fehler hier brechen den Sync nicht ab.
    let autoDraft: (Partial<ReplyVariants> & { variants: Record<string, string> }) | null = null
    let stage: string | null = null
    if (p.messages.length) {
      try {
        const ctx = await loadContactContext(contactId, supabase)
        if (ctx) {
          const [summary, analysis] = await Promise.all([
            summarizeConversation(ctx),
            analyzeStage(ctx),
          ])
          await supabase.from("conversation_summaries").insert({
            contact_id: contactId,
            summary: summary.summary,
          })
          if (summary.memories.length) {
            await supabase.from("memories").insert(
              summary.memories.map((m) => ({ contact_id: contactId, ...m }))
            )
          }
          stage = analysis.stage
          await supabase
            .from("contacts")
            .update({
              pipeline_stage: analysis.stage,
              next_step: analysis.next_step,
              date_idea: analysis.date_idea ?? undefined,
            })
            .eq("id", contactId)
          if (analysis.followup_in_days != null) {
            const due = new Date()
            due.setDate(due.getDate() + analysis.followup_in_days)
            await supabase.from("followups").insert({
              contact_id: contactId,
              due_at: due.toISOString(),
              reason: analysis.followup_reason,
            })
          }

          // Sofort-Entwurf, wenn die Person zuletzt geschrieben hat
          const lastMsg = ctx.messages[ctx.messages.length - 1]
          if (lastMsg?.direction === "in") {
            const { data: openDraft } = await supabase
              .from("suggestions")
              .select("id, variants")
              .eq("contact_id", contactId)
              .in("status", ["draft", "approved"])
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
            if (openDraft) {
              // Offener Entwurf vorhanden — direkt im Overlay anzeigen statt nichts
              autoDraft = { variants: (openDraft.variants ?? {}) as Record<string, string> }
            } else {
              autoDraft = await generateReplies(
                ctx,
                "Antworte passend auf die letzte Nachricht der Person.",
                nowLocal
              )
              await supabase.from("suggestions").insert({
                contact_id: contactId,
                situation: "Auto-Entwurf nach Browser-Sync",
                variants: autoDraft.variants,
                channel: "manual",
                status: "draft",
              })
            }
          }
        }
      } catch {
        // Analyse optional — Sync-Ergebnis zählt
      }
    }

    return NextResponse.json(
      {
        contactId,
        name: p.name,
        isNew: !existing,
        messageCount: p.messages.length,
        stage,
        autoDraft,
      },
      { headers: cors }
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync-Fehler" },
      { status: 500, headers: cors }
    )
  }
}
