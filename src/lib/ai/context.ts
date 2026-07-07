import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/lib/database.types"

export type ContactContext = {
  contact: Tables<"contacts">
  messages: Tables<"messages">[]
  memories: Tables<"memories">[]
  summary: string | null
  styleProfile: string
}

const DEFAULT_STYLE =
  "Natürlich, direkt, leicht humorvoll, charmant. Nicht generisch, nicht übertrieben, nicht peinlich, nicht cringe. Kurze Nachrichten wie echte Chat-Nachrichten, keine Aufsätze."

export async function loadContactContext(
  contactId: string,
  client?: SupabaseClient<Database>
): Promise<ContactContext | null> {
  const supabase = client ?? (await createClient())

  const [contactRes, messagesRes, memoriesRes, summaryRes, styleRes] =
    await Promise.all([
      supabase.from("contacts").select("*").eq("id", contactId).single(),
      supabase
        .from("messages")
        .select("*")
        .eq("contact_id", contactId)
        .order("sent_at", { ascending: false })
        .limit(20),
      supabase.from("memories").select("*").eq("contact_id", contactId),
      supabase
        .from("conversation_summaries")
        .select("summary")
        .eq("contact_id", contactId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("settings")
        .select("value")
        .eq("key", "user_style_profile")
        .maybeSingle(),
    ])

  if (contactRes.error || !contactRes.data) return null

  const styleValue = styleRes.data?.value
  const styleProfile =
    typeof styleValue === "string" && styleValue.trim()
      ? styleValue
      : DEFAULT_STYLE

  return {
    contact: contactRes.data,
    messages: (messagesRes.data ?? []).reverse(),
    memories: memoriesRes.data ?? [],
    summary: summaryRes.data?.summary ?? null,
    styleProfile,
  }
}

export function contextToPrompt(ctx: ContactContext): string {
  const { contact, messages, memories, summary } = ctx
  const memBlock = memories
    .map((m) => `- [${m.kind}] ${m.content}`)
    .join("\n")
  const msgBlock = messages
    .map((m) => `${m.direction === "out" ? "ICH" : contact.name}: ${m.content}`)
    .join("\n")

  return `## Person
Name: ${contact.name}
Plattform: ${contact.platform}${contact.age ? `\nAlter: ${contact.age}` : ""}${contact.location ? `\nOrt: ${contact.location}` : ""}
Sprache: ${contact.language ?? "de"}
Interessen: ${(contact.interests ?? []).join(", ") || "unbekannt"}
Bio: ${contact.bio ?? "—"}
Notizen: ${contact.notes ?? "—"}
Pipeline-Stage: ${contact.pipeline_stage}
Geplante Date-Idee: ${contact.date_idea ?? "—"}

## Gedächtnis
${memBlock || "— noch leer —"}

## Gesprächszusammenfassung
${summary ?? "— noch keine —"}

## Letzte Nachrichten (chronologisch)
${msgBlock || "— noch keine Nachrichten —"}`
}
