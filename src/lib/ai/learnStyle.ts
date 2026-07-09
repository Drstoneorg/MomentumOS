import { chatJSON } from "./deepseek"

export type LearnedStyle = {
  profile: string
  examples: string[]
}

/**
 * Analysiert echte eigene Nachrichten (aus gesyncten Chats + optional
 * hochgeladenen WhatsApp/Instagram-Exporten) und baut daraus ein
 * konkretes Stilprofil plus repräsentative Beispielnachrichten.
 */
export async function learnStyle(ownMessages: string[]): Promise<LearnedStyle> {
  const corpus = ownMessages
    .map((m) => m.trim())
    .filter((m) => m && m.length >= 2 && m.length <= 500)
  if (corpus.length < 5) {
    throw new Error(
      `Zu wenig Material: nur ${corpus.length} eigene Nachrichten gefunden (mindestens 5 nötig). Erst Chats syncen oder Export hochladen.`
    )
  }

  const system = `Du bist Stil-Analyst. Du bekommst echte Chat-Nachrichten EINER Person und beschreibst deren Schreibstil so präzise, dass eine KI ihn perfekt imitieren kann.

Analysiere konkret und beobachtbar (keine Psychologie): typische Länge, Groß-/Kleinschreibung, Satzzeichen-Gewohnheiten, Emoji-Nutzung (welche, wie oft), Füllwörter/Slang/Dialekt, Abkürzungen, wie Fragen gestellt werden, Humor-Muster, Begrüßungen/Verabschiedungen, was die Person NIE macht.

Antworte als JSON:
{
  "profile": "Stilbeschreibung in 5-10 kurzen, konkreten Regeln (eine pro Zeile), auf Deutsch",
  "examples": ["8-12 der repräsentativsten Original-Nachrichten, unverändert übernommen — bevorzugt welche, die den Stil am deutlichsten zeigen"]
}`

  const sample = corpus.slice(-400)
  const user = `Eigene Nachrichten (${sample.length} Stück, chronologisch):\n${sample
    .map((m) => `- ${m}`)
    .join("\n")}`.slice(0, 40000)

  const raw = await chatJSON(system, user, "learn_style")
  const parsed = JSON.parse(raw) as LearnedStyle
  if (!parsed.profile) throw new Error("Analyse fehlgeschlagen — bitte nochmal versuchen.")
  return {
    profile: String(parsed.profile).trim(),
    examples: (parsed.examples ?? []).map(String).slice(0, 12),
  }
}
