import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { loadContactContext } from "@/lib/ai/context"
import { generateReplies } from "@/lib/ai/generateReplies"
import { sendPushToAll } from "@/lib/push"
import { beatCron, cronAuthError } from "@/lib/cronHeartbeat"

export const maxDuration = 60

const STALE_DAYS = 3
const AUTO_ARCHIVE_DAYS = 90

/**
 * Autonome Follow-up-Engine. Scannt eingeschlafene Gespräche, generiert je einen
 * Nachfass-Entwurf in die Queue (status=draft). Sendet nichts — Freigabe bleibt manuell.
 *
 * Schutz: siehe cronAuthError — Bearer CRON_SECRET, fail-closed.
 */
export async function GET(req: Request) {
  const denied = cronAuthError(req)
  if (denied) return denied

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
      // Ghosting (ich schrieb zuletzt, keine Antwort) braucht einen anderen Ton
      // als Einschlafen: nachhaken wirkt bedürftig — neuer Aufhänger statt Echo.
      const daysSilent = Math.round((Date.now() - new Date(lastMsg.sent_at).getTime()) / 86400_000)
      const ghosted = lastMsg.direction === "out"
      const reply = await generateReplies(
        ctx,
        ghosted
          ? `Die Person hat auf meine letzte Nachricht seit ${daysSilent} Tagen nicht geantwortet. NICHT nachhaken, die alte Nachricht NICHT erwähnen — stattdessen ein komplett neuer, leichter Aufhänger (ein Interesse aus dem Gedächtnis, etwas Alltägliches, eine spielerische Beobachtung). Null Vorwurf, null Druck, sehr kurz.`
          : `Das Gespräch ist seit über ${STALE_DAYS} Tagen eingeschlafen. Schreibe eine leichte, nicht aufdringliche Nachricht, die natürlich wieder anknüpft.`
      )
      await supabase.from("suggestions").insert({
        contact_id: c.id,
        situation: ghosted
          ? `Auto-Reaktivierung (${daysSilent}d keine Antwort auf meine Nachricht)`
          : `Auto-Follow-up (eingeschlafen seit ${STALE_DAYS}+ Tagen)`,
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

  // Auto-Archiv: Match-Kontakte ohne jede Aktivität seit 90+ Tagen sind keine
  // Pipeline mehr, sondern Rauschen — Scoring und Dashboard sollen nicht lügen.
  // Dashboard warnt ab 60 Tagen vor, hier fällt nur der Vorhang. Umkehrbar
  // (Stage manuell zurückstellen), niemals löschen.
  let autoArchived = 0
  try {
    const { data: allMatches } = await supabase
      .from("contacts")
      .select("id, created_at")
      .eq("realm", "match")
      .neq("pipeline_stage", "archived")
    const { data: allLast } = await supabase
      .from("messages")
      .select("contact_id, sent_at")
      .order("sent_at", { ascending: false })
    const lastBy = new Map<string, string>()
    for (const m of allLast ?? []) {
      if (!lastBy.has(m.contact_id)) lastBy.set(m.contact_id, m.sent_at)
    }
    const cutoff = Date.now() - AUTO_ARCHIVE_DAYS * 86400_000
    const dead = (allMatches ?? []).filter((c) => {
      const lastActivity = lastBy.get(c.id) ?? c.created_at
      return new Date(lastActivity).getTime() < cutoff
    })
    if (dead.length) {
      await supabase
        .from("contacts")
        .update({ pipeline_stage: "archived" })
        .in("id", dead.map((c) => c.id))
      autoArchived = dead.length
    }
  } catch {
    // Aufräumen optional
  }

  const drafts = results.filter((r) => r.status === "draft_created").length
  if (drafts) {
    await sendPushToAll({
      title: "MomentumOS Follow-ups",
      body: `${drafts} neue Antwort-Entwürfe warten in der Queue`,
      url: "/queue",
    }).catch(() => {})
  }

  return NextResponse.json({ scanned: contacts?.length ?? 0, autoArchived, results })
}
