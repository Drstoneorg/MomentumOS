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

  const { raw, platform, externalId, nowLocal, chatTail } = await req.json()
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

    // Nur neue Nachrichten anhängen. Dedupe normalisiert (Whitespace/Groß-Klein/
    // Satzzeichen am Ende), vergleicht gegen letzte 300 UND innerhalb des Batches —
    // sonst erzeugen erneute Scans langer Chats Duplikate.
    const normMsg = (s: string) =>
      s.toLowerCase().replace(/\s+/g, " ").replace(/[.!?…]+$/g, "").trim()
    let freshInbound = false // kam in DIESEM Sync eine neue Nachricht der Person rein?
    if (p.messages.length) {
      const { data: recent } = await supabase
        .from("messages")
        .select("direction, content, sent_at")
        .eq("contact_id", contactId)
        .order("sent_at", { ascending: false })
        .limit(300)
      const knownAt = new Map<string, string>()
      for (const m of recent ?? []) {
        const k = `${m.direction}|${normMsg(m.content)}`
        if (!knownAt.has(k)) knownAt.set(k, m.sent_at)
      }
      // Batch in Scan-Reihenfolge annotieren: bekannt (mit sent_at) oder frisch.
      const seen = new Set(knownAt.keys())
      const batch: { m: (typeof p.messages)[number]; known: string | null }[] = []
      for (const m of p.messages) {
        const key = `${m.direction}|${normMsg(m.content)}`
        const known = knownAt.get(key) ?? null
        if (!known && seen.has(key)) continue // batch-internes Duplikat
        seen.add(key)
        batch.push({ m, known })
      }
      // Zeitstempel: frische Nachrichten, die im Scan VOR einer bereits bekannten
      // stehen, sind Backfill (User hat hochgescrollt, ältere Nachrichten wurden
      // sichtbar). Die dürfen NICHT "jetzt" bekommen — sonst landen sie als
      // neueste in der Chronologie und die KI antwortet auf alte Nachrichten.
      // Anker = sent_at der nächsten bekannten Nachricht rechts davon.
      const nextKnownAt: (string | null)[] = new Array(batch.length)
      let nk: string | null = null
      for (let i = batch.length - 1; i >= 0; i--) {
        nextKnownAt[i] = nk
        if (batch[i].known) nk = batch[i].known
      }
      const groups = new Map<string | null, (typeof p.messages)[number][]>()
      batch.forEach((e, i) => {
        if (e.known) return
        const anchor = nextKnownAt[i]
        if (!groups.has(anchor)) groups.set(anchor, [])
        groups.get(anchor)!.push(e.m)
      })
      const rows: {
        contact_id: string
        direction: "in" | "out"
        channel: string
        content: string
        source: "import"
        sent_at: string
      }[] = []
      for (const [anchor, list] of groups) {
        const baseT =
          (anchor ? new Date(anchor).getTime() : Date.now()) - list.length * 1000
        list.forEach((m, i) =>
          rows.push({
            contact_id: contactId,
            direction: m.direction,
            channel: "dating_app",
            content: m.content,
            source: "import" as const,
            sent_at: new Date(baseT + i * 1000).toISOString(),
          })
        )
      }
      // Nur echte NEUE Nachrichten (ohne Anker = am Chat-Ende) zählen als frisch —
      // Backfill beim Hochscrollen soll keinen neuen Entwurf auslösen.
      freshInbound = (groups.get(null) ?? []).some((m) => m.direction === "in")
      if (rows.length) await supabase.from("messages").insert(rows)
    }
    if (p.memories.length && !existing) {
      await supabase.from("memories").insert(
        p.memories.map((m) => ({ contact_id: contactId, ...m }))
      )
    }

    // Auto-Pipeline: Zusammenfassung + Stage-Analyse + Sofort-Entwurf,
    // wenn ein Chatverlauf dabei war. Fehler hier brechen den Sync nicht ab.
    // Live-Chat aus dem Browser-DOM hat Vorrang vor evtl. veraltetem DB-Stand —
    // gleicher Mechanismus wie in /api/extension/replies.
    const draftSituation = (base: string) =>
      typeof chatTail === "string" && chatTail.trim()
        ? `${base}\n\nAktueller Chat-Ausschnitt direkt aus dem Browser ([me]=ich, [them]=Person):\n${chatTail
            .trim()
            .slice(0, 2000)}\nAntworte auf die letzte [them]-Nachricht.`
        : base
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

          // Sofort-Entwurf, wenn die Person zuletzt geschrieben hat.
          // Browser-DOM ist verlässlicher als DB-Chronologie (Scroll-Backfill).
          const tailLines =
            typeof chatTail === "string" ? chatTail.trim().split("\n").filter(Boolean) : []
          const lastTail = tailLines[tailLines.length - 1] ?? ""
          const lastMsg = ctx.messages[ctx.messages.length - 1]
          const theirTurn = lastTail
            ? lastTail.startsWith("[them]")
            : lastMsg?.direction === "in"
          if (theirTurn) {
            const { data: openDraft } = await supabase
              .from("suggestions")
              .select("id, variants")
              .eq("contact_id", contactId)
              .in("status", ["draft", "approved"])
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
            if (openDraft && !freshInbound) {
              // Offener Entwurf, nichts Neues von der Person — Entwurf direkt anzeigen
              autoDraft = { variants: (openDraft.variants ?? {}) as Record<string, string> }
            } else if (openDraft && freshInbound) {
              // Neue Nachricht der Person: alter Entwurf ist veraltet — neu generieren
              // und den offenen Entwurf aktualisieren (kein Duplikat in der Queue).
              autoDraft = await generateReplies(
                ctx,
                draftSituation("Antworte passend auf die letzte Nachricht der Person."),
                nowLocal
              )
              await supabase
                .from("suggestions")
                .update({
                  situation: "Auto-Entwurf nach Browser-Sync (aktualisiert)",
                  variants: autoDraft.variants,
                  status: "draft",
                })
                .eq("id", openDraft.id)
            } else {
              autoDraft = await generateReplies(
                ctx,
                draftSituation("Antworte passend auf die letzte Nachricht der Person."),
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
