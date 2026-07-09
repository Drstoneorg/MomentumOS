import type { Tables } from "@/lib/database.types"

/**
 * Privacy-Whitelist für TCG-Karten: Nur allgemeine, unkritische Infos werden
 * überhaupt als Auswahl angeboten. Deterministisch — kein LLM entscheidet hier.
 *
 * ERLAUBT: Vorname, Interessen/Hobbies, positive Gedächtnis-Einträge
 * (likes, topic_works), Sprache/Kultur-Flair, abgeleiteter Match-Score als Spielwert.
 *
 * GESPERRT (wird nie angeboten, egal was gewählt ist): bio, notes, photo_notes,
 * Wohnort/Entfernung, Alter, Beruf, Nachname, Chatnachrichten, memories der Arten
 * fact / dislikes / open_question / boundary (zu persönlich bzw. sensibel).
 */

export type CardFact = {
  id: string
  label: string
  value: string
  source: "name" | "interest" | "memory" | "language" | "score"
}

const ALLOWED_MEMORY_KINDS = new Set(["likes", "topic_works"])

export function cardSafeFacts(
  contact: Tables<"contacts">,
  memories: Pick<Tables<"memories">, "id" | "kind" | "content">[],
  matchScore?: number
): CardFact[] {
  const facts: CardFact[] = []

  const firstName = (contact.name ?? "").trim().split(/\s+/)[0]
  if (firstName) {
    facts.push({ id: "name", label: "Vorname", value: firstName, source: "name" })
  }

  for (const [i, it] of (contact.interests ?? []).entries()) {
    const v = it.trim()
    if (v) facts.push({ id: `interest-${i}`, label: "Interesse", value: v, source: "interest" })
  }

  for (const m of memories) {
    if (!ALLOWED_MEMORY_KINDS.has(m.kind)) continue
    const v = m.content.trim()
    if (v) {
      facts.push({
        id: `memory-${m.id}`,
        label: m.kind === "likes" ? "Mag" : "Thema, das zieht",
        value: v,
        source: "memory",
      })
    }
  }

  const lang = (contact.language ?? "").trim()
  if (lang && !lang.toLowerCase().startsWith("de")) {
    facts.push({ id: "language", label: "Sprache/Kultur-Flair", value: lang, source: "language" })
  }

  if (typeof matchScore === "number" && Number.isFinite(matchScore)) {
    facts.push({
      id: "score",
      label: "Match-Score als Spielwert",
      value: String(Math.round(matchScore)),
      source: "score",
    })
  }

  return facts
}
