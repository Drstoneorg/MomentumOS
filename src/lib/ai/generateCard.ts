import { chatJSON } from "./deepseek"
import { stripDashes } from "@/lib/text"
import type { CardFact } from "./cardFacts"

export type CardDetails = {
  title: string
  type_line: string // z. B. "Kreatur — Kletterfee" (Typzeile im TCG-Stil)
  element: string // z. B. Feuer/Wasser/Natur/Licht…
  rarity: "common" | "rare" | "epic" | "legendary"
  attack: number
  defense: number
  effect: string // Karteneffekt, spielbar formuliert
  flavor: string // Flavor-Text, kurz und stimmungsvoll
  image_prompt: string // Prompt für das Kartenbild (ohne reale Person)
}

/**
 * Baut Kartendetails aus den freigegebenen Fakten. Der Prompt bekommt NUR die
 * Whitelist-Fakten — nichts anderes über die Person. Zusätzliche Leitplanke im
 * Prompt: keine privaten Details erfinden oder durchsickern lassen.
 */
export async function generateCardDetails(
  facts: CardFact[],
  wishes?: string
): Promise<CardDetails> {
  const factLines = facts.map((f) => `- ${f.label}: ${f.value}`).join("\n")

  const system = `Du bist Designer für ein Sammelkartenspiel (TCG). Du entwirfst EINE personalisierte Karte.

Regeln:
- Nutze AUSSCHLIESSLICH die gelieferten Fakten. Erfinde keine persönlichen Details (kein Wohnort, Alter, Beruf, Aussehen, Beziehungsstatus).
- Interessen/Hobbies werden zu Fähigkeiten, Effekten und Bildmotiven (z. B. Klettern = "Klettert auf gegnerische Karten", Sushi = "Heilt 200 LP").
- image_prompt: illustrativ, Fantasy/Anime-Trading-Card-Art, KEINE reale oder identifizierbare Person, kein Portrait-Realismus. Motive aus den Interessen.
- Werte: attack/defense 100-3000 in 100er-Schritten, passend zu rarity.
- Texte auf Deutsch, kurz und punchy. Keine Binde- oder Gedankenstriche.

Antworte als JSON:
{ "title": "...", "type_line": "...", "element": "...", "rarity": "common|rare|epic|legendary", "attack": 0, "defense": 0, "effect": "...", "flavor": "...", "image_prompt": "..." }`

  const user = `## Freigegebene Fakten
${factLines || "- (keine Fakten gewählt, entwirf eine generische Karte)"}
${wishes ? `\n## Wünsche des Nutzers\n${wishes}` : ""}`

  const raw = await chatJSON(system, user, "tcg_card")
  const parsed = JSON.parse(raw) as CardDetails
  parsed.title = stripDashes(parsed.title ?? "")
  parsed.effect = stripDashes(parsed.effect ?? "")
  parsed.flavor = stripDashes(parsed.flavor ?? "")
  parsed.attack = Math.max(0, Math.round(Number(parsed.attack) || 0))
  parsed.defense = Math.max(0, Math.round(Number(parsed.defense) || 0))
  if (!["common", "rare", "epic", "legendary"].includes(parsed.rarity)) parsed.rarity = "common"
  return parsed
}
