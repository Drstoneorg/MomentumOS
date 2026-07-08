import { chatJSON } from "./deepseek"
import { contextToPrompt, type ContactContext } from "./context"
import type { Enums } from "@/lib/database.types"

export type SummaryResult = {
  summary: string
  memories: { kind: Enums<"memory_kind">; content: string }[]
}

const KINDS = [
  "likes",
  "dislikes",
  "fact",
  "open_question",
  "boundary",
  "topic_works",
] as const

export async function summarizeConversation(
  ctx: ContactContext
): Promise<SummaryResult> {
  const system = `Du analysierst ein Dating-Gespräch und pflegst ein Personengedächtnis.
Antworte als JSON:
{
  "summary": "kompakte Zusammenfassung: worüber gesprochen, Stimmung, Stand, was als nächstes sinnvoll",
  "memories": [ { "kind": "${KINDS.join("|")}", "content": "kurzer Fakt" } ]
}
Nur NEUE Gedächtnis-Einträge, die noch nicht im bestehenden Gedächtnis stehen. Maximal 8.`

  const raw = await chatJSON(system, contextToPrompt(ctx), "summarize")
  const parsed = JSON.parse(raw) as SummaryResult
  parsed.memories = (parsed.memories ?? []).filter((m) =>
    (KINDS as readonly string[]).includes(m.kind)
  )
  return parsed
}
