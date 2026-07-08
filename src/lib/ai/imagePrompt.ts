import { chatJSON } from "./deepseek"

export type ImagePromptInput = {
  occasion: string // "Geburtstag", "Dokomi-Einladung", …
  name: string
  style: string // "Anime", "Aquarell", "3D", "Retro-Poster", …
  details: string // Interessen, Vibe, Farben
  format: "portrait" | "square" | "story" | "landscape"
}

export type ImagePromptResult = {
  prompt: string
  negative_prompt: string
  caption: string
}

const RATIO: Record<ImagePromptInput["format"], string> = {
  portrait: "4:5",
  square: "1:1",
  story: "9:16",
  landscape: "16:9",
}

/**
 * Erzeugt einen fertigen Bild-Generierungs-Prompt (für Midjourney/DALL-E/SDXL).
 * MatchOS generiert keine Pixel — der Prompt wird in der Asset Library gespeichert,
 * das fertige Bild lädt man als URL zurück.
 */
export async function generateImagePrompt(
  input: ImagePromptInput
): Promise<ImagePromptResult> {
  const system = `Du schreibst hochwertige englische Bild-Prompts für Bildgeneratoren (Midjourney/DALL-E/SDXL).
Antworte als JSON:
{
  "prompt": "detaillierter englischer Prompt, inkl. Stil, Licht, Komposition, --ar ${RATIO[input.format]}",
  "negative_prompt": "was vermieden werden soll",
  "caption": "kurze deutsche Bildunterschrift/Story-Text zum Mitschicken"
}
Kein Text im Bild außer wenn ausdrücklich gewünscht. Anlass klar erkennbar.`

  const user = `Anlass: ${input.occasion}
Für: ${input.name}
Stil: ${input.style}
Details/Vibe: ${input.details || "—"}
Format: ${input.format} (${RATIO[input.format]})`

  const raw = await chatJSON(system, user, "image_prompt")
  return JSON.parse(raw) as ImagePromptResult
}
