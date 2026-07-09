import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { loadContactContext } from "@/lib/ai/context"
import { generateReplies } from "@/lib/ai/generateReplies"
import { sendPushToAll } from "@/lib/push"
import { beatCron } from "@/lib/cronHeartbeat"

export const maxDuration = 60

const STALE_DAYS = 3

/**
 * Autonome Follow-up-Engine. Scannt eingeschlafene Gespräche, generiert je einen
 * Nachfass-Entwurf in die Queue (status=draft). Sendet nichts — Freigabe bleibt manuell.
 *
 * Schutz: Header `Authorization: Bearer <CRON_SECRET>`. Vercel-Cron setzt das automatisch,
 * wenn CRON_SECRET als Env-Var gesetzt ist.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  await beatCron(supabase, "followups")
  const staleCutoff = new Date(Date.now() - STALE_DAYS * 86400_000)

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, pipeline_stage")
    .in("pipeline_stage", ["chatting", "interest_visible", "on_messenger", "platform_switch"])

  const results: { contactId: string; status: string }[] = []

  for (const c of contacts ?? []) {
    // Letzte Nachricht prüfen
    const { data: lastMsg } = await supabase
      .from("messages")
      .select("sent_at, direction")
      .eq("contact_id", c.id)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!lastMsg || new Date(lastMsg.sent_at) > staleCutoff) continue
    // Nur nachfassen, wenn die Person zuletzt geschrieben hat oder es beidseitig ruht
    // (kein Doppel-Nachfassen, wenn schon ein offener Entwurf existiert)
    const { data: existingDraft } = await supabase
      .from("suggestions")
      .select("id")
      .eq("contact_id", c.id)
      .in("status", ["draft", "approved"])
      .limit(1)
      .maybeSingle()
    if (existingDraft) {
      results.push({ contactId: c.id, status: "skip_existing_draft" })
      continue
    }

    try {
      const ctx = await loadContactContext(c.id, supabase)
      if (!ctx) continue
      const reply = await generateReplies(
        ctx,
        `Das Gespräch ist seit über ${STALE_DAYS} Tagen eingeschlafen. Schreibe eine leichte, nicht aufdringliche Nachricht, die natürlich wieder anknüpft.`
      )
      await supabase.from("suggestions").insert({
        contact_id: c.id,
        situation: `Auto-Follow-up (eingeschlafen seit ${STALE_DAYS}+ Tagen)`,
        variants: reply.variants,
        channel: "manual",
        status: "draft",
      })
      results.push({ contactId: c.id, status: "draft_created" })
    } catch (e) {
      results.push({
        contactId: c.id,
        status: `error: ${e instanceof Error ? e.message : "unknown"}`,
      })
    }
  }

  const drafts = results.filter((r) => r.status === "draft_created").length
  if (drafts) {
    await sendPushToAll({
      title: "MatchOS Follow-ups",
      body: `${drafts} neue Antwort-Entwürfe warten in der Queue`,
      url: "/queue",
    }).catch(() => {})
  }

  return NextResponse.json({ scanned: contacts?.length ?? 0, results })
}
