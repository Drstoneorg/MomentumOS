// Foto-Analyse via OpenAI-Vision (Chat mit Bild-Input). Prüft ein Profilfoto
// gegen das Beuteschema (include/avoid). Key-gated wie die Bild-Generierung.

export function visionApiKey(): string | null {
  return process.env.OPENAI_API_KEY || process.env.VISION_API_KEY || null
}

export function visionAvailable(): boolean {
  return !!visionApiKey()
}

const MODEL = process.env.VISION_MODEL || "gpt-4o-mini"

export type PhotoVerdict = {
  score: number // 0–100: Passung zum Typ
  matches: boolean // grobe Ja/Nein-Empfehlung
  summary: string // ein Satz
  traits: string[] // erkannte Merkmale (neutral, beschreibend)
  hits: string[] // Beuteschema-Treffer (include)
  concerns: string[] // Ausschluss-Treffer (avoid) oder Bedenken
}

type Taste = { include: string[]; avoid: string[] }

/**
 * Analysiert ein Bild (öffentliche URL oder data:-URL) gegen das Beuteschema.
 * Rein beschreibend — keine Identifikation realer Personen, kein Urteil über Attraktivität
 * über die vom Nutzer definierten Kriterien hinaus.
 */
export async function analyzePhoto(
  image: { url?: string; dataUrl?: string },
  taste: Taste
): Promise<PhotoVerdict> {
  const key = visionApiKey()
  if (!key) throw new Error("Kein Vision-API-Key (OPENAI_API_KEY) gesetzt")
  const imageUrl = image.dataUrl || image.url
  if (!imageUrl) throw new Error("Kein Bild übergeben")

  const system = `Du hilfst einem Nutzer, Dating-Profilfotos gegen seine selbst definierten Vorlieben abzugleichen.
Beschreibe sichtbare, neutrale Merkmale (Stil, Setting, Vibe, Aktivität, Hobbys-Hinweise). Identifiziere KEINE realen Personen und rate keine sensiblen Attribute (Ethnie, Religion, Gesundheit) über das hinaus, was der Nutzer als Kriterien nennt.
Nutzer-Vorlieben:
- gewünscht (include): ${taste.include.join(", ") || "—"}
- unerwünscht (avoid): ${taste.avoid.join(", ") || "—"}
Antworte als JSON:
{
  "score": 0-100,
  "matches": true|false,
  "summary": "ein knapper Satz",
  "traits": ["neutrale Merkmale"],
  "hits": ["welche include-Kriterien sichtbar zutreffen"],
  "concerns": ["welche avoid-Kriterien oder Bedenken sichtbar sind"]
}`

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: "Gleiche dieses Profilfoto gegen meine Vorlieben ab." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  })
  if (!res.ok) {
    throw new Error(`Vision-API-Fehler ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as Partial<PhotoVerdict>

  return {
    score: clamp(Number(parsed.score) || 0),
    matches: !!parsed.matches,
    summary: parsed.summary ?? "Keine Einschätzung möglich.",
    traits: arr(parsed.traits),
    hits: arr(parsed.hits),
    concerns: arr(parsed.concerns),
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
}
