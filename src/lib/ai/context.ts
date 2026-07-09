import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/lib/database.types"

export type ContactContext = {
  contact: Tables<"contacts">
  messages: Tables<"messages">[]
  memories: Tables<"memories">[]
  summary: string | null
  styleProfile: string
  styleRules: string
}

// Harte Regeln, die IMMER gelten — zusätzlich zu den in den Einstellungen
// gepflegten Regeln (settings-Key "user_style_rules").
export const BASE_STYLE_RULES =
  "Niemals Binde- oder Gedankenstriche verwenden (kein -, – oder —), weder als Satzzeichen noch in Wörtern — Wörter stattdessen zusammen oder getrennt schreiben. Keine Aufzählungszeichen. Klingt wie getippt, nicht wie generiert."

const DEFAULT_STYLE =
  "Natürlich, direkt, leicht humorvoll, charmant. Nicht generisch, nicht übertrieben, nicht peinlich, nicht cringe. Kurze Nachrichten wie echte Chat-Nachrichten, keine Aufsätze."

export async function loadContactContext(
  contactId: string,
  client?: SupabaseClient<Database>
): Promise<ContactContext | null> {
  const supabase = client ?? (await createClient())

  const [
    contactRes,
    messagesRes,
    memoriesRes,
    summaryRes,
    styleRes,
    rulesRes,
    learnedRes,
    feedbackRes,
  ] = await Promise.all([
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
      supabase
        .from("settings")
        .select("value")
        .eq("key", "user_style_rules")
        .maybeSingle(),
      supabase
        .from("settings")
        .select("value")
        .eq("key", "learned_style")
        .maybeSingle(),
      supabase
        .from("reply_feedback")
        .select("content, rating")
        .order("created_at", { ascending: false })
        .limit(200),
    ])

  if (contactRes.error || !contactRes.data) return null

  const styleValue = styleRes.data?.value
  const manualStyle =
    typeof styleValue === "string" && styleValue.trim() ? styleValue.trim() : ""

  // Gelerntes Profil aus echten Nachrichten (settings-Key "learned_style",
  // geschrieben von /api/ai/learn-style): { profile: string, examples: string[] }
  const learnedValue = learnedRes.data?.value as
    | { profile?: string; examples?: string[] }
    | null
  const learnedProfile =
    typeof learnedValue?.profile === "string" ? learnedValue.profile.trim() : ""
  const learnedExamples = Array.isArray(learnedValue?.examples)
    ? learnedValue.examples.filter((e): e is string => typeof e === "string")
    : []

  // Daumen-Feedback: übernommene Vorschläge als Positiv-Beispiele,
  // abgelehnte als Anti-Beispiele.
  const feedback = feedbackRes.data ?? []
  const liked = feedback.filter((f) => f.rating === 1).slice(0, 10)
  const disliked = feedback.filter((f) => f.rating === -1).slice(0, 8)

  const parts = [manualStyle || (learnedProfile ? "" : DEFAULT_STYLE)]
  if (learnedProfile)
    parts.push(`Aus meinen echten Nachrichten gelernt:\n${learnedProfile}`)
  if (learnedExamples.length)
    parts.push(
      `Echte Beispielnachrichten von mir (Ton, Länge, Schreibweise exakt so treffen):\n${learnedExamples
        .map((e) => `- ${e}`)
        .join("\n")}`
    )
  if (liked.length)
    parts.push(
      `Vorschläge, die ich übernommen habe (so will ich klingen):\n${liked
        .map((f) => `- ${f.content}`)
        .join("\n")}`
    )
  if (disliked.length)
    parts.push(
      `Vorschläge, die ich abgelehnt habe (so NICHT klingen):\n${disliked
        .map((f) => `- ${f.content}`)
        .join("\n")}`
    )
  const styleProfile = parts.filter(Boolean).join("\n\n")

  const rulesValue = rulesRes.data?.value
  const userRules = typeof rulesValue === "string" ? rulesValue.trim() : ""
  const styleRules = [BASE_STYLE_RULES, userRules].filter(Boolean).join("\n")

  return {
    contact: contactRes.data,
    messages: (messagesRes.data ?? []).reverse(),
    memories: memoriesRes.data ?? [],
    summary: summaryRes.data?.summary ?? null,
    styleProfile,
    styleRules,
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
