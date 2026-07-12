import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { loadContactContext } from "./context"
import { generateReplies, type ReplyVariants } from "./generateReplies"

export const OPENER_SITUATION =
  "Erste Nachricht (Opener) an ein neues Match — es gibt noch KEINEN Chatverlauf. " +
  "Knüpfe KONKRET an ihr Profil an (Bio, Interessen, Foto-Notizen): etwas, das zeigt, dass ich wirklich hingeschaut habe. " +
  "Kein generisches Hi, kein Kompliment über Aussehen. Eine leichte Frage oder ein spielerischer Bezug, der einfach zu beantworten ist. Kurz, 1 bis 2 Sätze."

/**
 * Auto-Opener: für frisch erfasste Kontakte ohne Chatverlauf direkt 5 Stil-Varianten
 * als Entwurf in die Queue legen. Sendet nichts — Vorschlag liegt nur bereit.
 * Best-Effort: Fehler (kein KI-Key, Budget voll) brechen die Erfassung nie ab.
 */
export async function createOpenerDraft(
  supabase: SupabaseClient<Database>,
  contactId: string,
  nowLocal?: string
): Promise<ReplyVariants | null> {
  try {
    // Kein Doppel-Entwurf, wenn schon einer offen ist
    const { data: open } = await supabase
      .from("suggestions")
      .select("id, variants")
      .eq("contact_id", contactId)
      .in("status", ["draft", "approved"])
      .limit(1)
      .maybeSingle()
    if (open) {
      return { variants: (open.variants ?? {}) as Record<string, string> } as ReplyVariants
    }
    const ctx = await loadContactContext(contactId, supabase)
    if (!ctx) return null
    // Ohne Profildaten gäbe es nur generische Opener — dann lieber keinen
    const hasData = !!ctx.contact.bio || (ctx.contact.interests?.length ?? 0) > 0 || !!ctx.contact.notes
    if (!hasData) return null
    const reply = await generateReplies(ctx, OPENER_SITUATION, nowLocal)
    await supabase.from("suggestions").insert({
      contact_id: contactId,
      situation: "Auto-Opener (neues Match)",
      variants: reply.variants,
      channel: "manual",
      status: "draft",
    })
    return reply
  } catch {
    return null
  }
}
