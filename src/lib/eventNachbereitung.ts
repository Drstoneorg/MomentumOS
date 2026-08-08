import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

/**
 * Event-Nachbereitung nach Check-in (Status attended): Gedächtnis-Eintrag,
 * Follow-up für morgen und optional ein Danke/Wie-wars-Entwurf. Geteilt
 * zwischen dem eingeloggten Tür-Modus und dem Türsteher-Link — der öffentliche
 * Weg lässt den KI-Entwurf weg (kein Modellaufruf von außen antriggerbar).
 * Best-Effort: der Statuswechsel gilt auch, wenn hier etwas hakt.
 */
export async function eventNachbereitung(
  supabase: SupabaseClient<Database>,
  inviteId: string,
  eventId: string,
  optionen: { mitEntwurf: boolean }
): Promise<void> {
  const [{ data: invite }, { data: event }] = await Promise.all([
    supabase.from("event_invites").select("contact_id").eq("id", inviteId).single(),
    supabase.from("events").select("title, starts_at").eq("id", eventId).single(),
  ])
  if (!invite || !event) return

  const dateStr = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null
  await supabase.from("memories").insert({
    contact_id: invite.contact_id,
    kind: "fact",
    content: `War bei meinem Event „${event.title}“${dateStr ? ` (${dateStr})` : ""} — persönlich getroffen`,
  })

  const { data: openFu } = await supabase
    .from("followups")
    .select("id")
    .eq("contact_id", invite.contact_id)
    .eq("done", false)
    .ilike("reason", `%${event.title}%`)
    .limit(1)
    .maybeSingle()
  if (!openFu) {
    const due = new Date()
    due.setDate(due.getDate() + 1)
    due.setHours(10, 0, 0, 0)
    await supabase.from("followups").insert({
      contact_id: invite.contact_id,
      due_at: due.toISOString(),
      reason: `Nach Event „${event.title}“ anschreiben — war da 🎉`,
    })
  }

  if (!optionen.mitEntwurf) return

  const { data: openDraft } = await supabase
    .from("suggestions")
    .select("id")
    .eq("contact_id", invite.contact_id)
    .in("status", ["draft", "approved"])
    .limit(1)
    .maybeSingle()
  if (openDraft) return

  const { loadContactContext } = await import("@/lib/ai/context")
  const { generateReplies } = await import("@/lib/ai/generateReplies")
  const ctx = await loadContactContext(invite.contact_id, supabase)
  if (!ctx) return
  const reply = await generateReplies(
    ctx,
    `Die Person war bei meinem Event „${event.title}“ und wir haben uns dort persönlich getroffen. Schreibe eine lockere Nachfass-Nachricht: freut mich dass du da warst, wie fandest du es. Kein Marketing, kein Ticket-Gerede, einfach warm und persönlich.`
  )
  await supabase.from("suggestions").insert({
    contact_id: invite.contact_id,
    situation: `Event-Nachbereitung „${event.title}“ (war da)`,
    variants: reply.variants,
    channel: "manual",
    status: "draft",
  })
}
