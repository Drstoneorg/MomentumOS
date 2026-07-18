import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { detectPromise, promiseSnippet } from "@/lib/promiseDetect"

/**
 * Prüft eingehende Nachrichten auf Zusagen („meld mich nächste Woche") und
 * legt automatisch EIN Follow-up an. Dedupe: existiert schon eine offene
 * Zusagen-Wiedervorlage für den Kontakt, passiert nichts. Fehler brechen
 * den Import nie ab — Aufrufer wrappen in try/catch, hier wird still gearbeitet.
 */
export async function maybeCreatePromiseFollowup(
  supabase: SupabaseClient<Database>,
  contactId: string,
  messages: { direction: string; content: string | null }[],
  now = new Date()
): Promise<boolean> {
  const inbound = messages.filter((m) => m.direction === "in" && m.content)
  // Neueste zuerst prüfen — die aktuellste Zusage zählt
  for (const m of [...inbound].reverse()) {
    const hit = detectPromise(m.content!, now)
    if (!hit) continue
    const { data: open } = await supabase
      .from("followups")
      .select("id, reason")
      .eq("contact_id", contactId)
      .eq("done", false)
    if ((open ?? []).some((f) => f.reason?.startsWith("⏳ Zusage"))) return false
    const { error } = await supabase.from("followups").insert({
      contact_id: contactId,
      due_at: hit.dueAt.toISOString(),
      reason: `⏳ ${hit.label}: „${promiseSnippet(m.content!)}" — nachhaken, falls nichts kam`,
    })
    return !error
  }
  return false
}
