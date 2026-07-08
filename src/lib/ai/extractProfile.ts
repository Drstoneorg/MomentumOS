import { chatJSON } from "./deepseek"
import type { Enums } from "@/lib/database.types"

export type ExtractedProfile = {
  name: string
  age: number | null
  location: string | null
  language: string
  platform: string
  bio: string | null
  interests: string[]
  notes: string | null
  messages: { direction: "in" | "out"; content: string }[]
  memories: { kind: Enums<"memory_kind">; content: string }[]
}

const KINDS = [
  "likes", "dislikes", "fact", "open_question", "boundary", "topic_works",
]

export async function extractProfile(
  raw: string,
  platformHint: string
): Promise<ExtractedProfile> {
  const system = `Du strukturierst rohen Text (kopiertes Dating-Profil und/oder Chatverlauf) in JSON.
Antworte als JSON:
{
  "name": "...",
  "age": 27,
  "location": "Stadt oder null",
  "language": "de|en|ja|zh — geschätzte Sprache der Person",
  "platform": "${platformHint || "tinder"}",
  "bio": "Profiltext oder null",
  "interests": ["..."],
  "notes": "auffällige Details (Fotos, Job, Vibe) oder null",
  "messages": [ { "direction": "in|out", "content": "..." } ],
  "memories": [ { "kind": "${KINDS.join("|")}", "content": "..." } ]
}
messages: nur wenn ein Chatverlauf erkennbar ist. "out" = vom Nutzer (oft mit 'ich:' markiert), "in" = von der Person. Reihenfolge chronologisch.
memories: was über die Person gelernt wurde. Leer lassen wenn nichts.
Wenn kein Name erkennbar: "Unbekannt".`

  const rawResult = await chatJSON(system, raw, "extract_profile")
  const parsed = JSON.parse(rawResult) as ExtractedProfile
  parsed.interests = parsed.interests ?? []
  parsed.messages = (parsed.messages ?? []).filter(
    (m) => m.content && (m.direction === "in" || m.direction === "out")
  )
  parsed.memories = (parsed.memories ?? []).filter((m) =>
    KINDS.includes(m.kind)
  )
  if (!parsed.name) parsed.name = "Unbekannt"
  if (!parsed.language) parsed.language = "de"
  if (!parsed.platform) parsed.platform = platformHint || "tinder"
  return parsed
}
