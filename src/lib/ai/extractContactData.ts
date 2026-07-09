// Universal-Kontakterfassung: liest Visitenkarten, Profil-Screenshots,
// Kontaktdaten-Fotos (Vision) oder Freitext (DeepSeek) und liefert
// strukturierte Kontaktdaten inkl. Kommunikationskanälen.

import { chatJSON } from "./deepseek"
import { visionApiKey } from "./vision"
import { assertBudget, logUsage } from "./usage"

const VISION_MODEL = process.env.VISION_MODEL || "gpt-4o-mini"

export type CapturedChannel = { channel: string; handle: string }

export type CapturedContact = {
  name: string
  kind: "dating" | "freund" | "business" | "unbekannt"
  age: number | null
  location: string | null
  language: string
  birthday: string | null // YYYY-MM-DD nur bei vollem Datum
  company: string | null
  bio: string | null
  interests: string[]
  notes: string | null
  tags: string[]
  channels: CapturedChannel[] // channel ∈ Kanal-Registry (telegram/whatsapp/sms/email/…)
}

const SCHEMA = `{
  "name": "voller Name oder bester Anhaltspunkt",
  "kind": "dating|freund|business|unbekannt",
  "age": Zahl oder null,
  "location": "Ort" oder null,
  "language": "de|en|…",
  "birthday": "YYYY-MM-DD" oder null (NUR wenn volles Datum inkl. Jahr sichtbar; sonst in notes erwähnen),
  "company": "Firma/Rolle" oder null,
  "bio": "kurze Beschreibung" oder null,
  "interests": ["…"],
  "notes": "alles Relevante, was sonst nirgends passt (z. B. Geburtstag ohne Jahr, Kontext des Kennenlernens)" oder null,
  "tags": ["freund"|"business"|"familie"|…] (Beziehungs-Tags, leer bei dating),
  "channels": [{ "channel": "whatsapp|telegram|sms|email|instagram|tiktok|snapchat|signal|messenger|discord|line|wechat", "handle": "Nummer/Handle/Adresse" }]
}
Regeln:
- Telefonnummern: als whatsapp UND sms Kanal aufnehmen (gleiche Nummer, international formatiert wenn möglich).
- E-Mail-Adressen: channel email.
- @handles dem sichtbaren Netzwerk zuordnen; unklar → notes.
- Nichts erfinden. Felder ohne Beleg: null/leer.`

/** Extrahiert Kontaktdaten aus einem Bild (data:-URL). Braucht Vision-Key. */
export async function extractContactFromImage(dataUrl: string): Promise<CapturedContact> {
  const key = visionApiKey()
  if (!key) throw new Error("Kein Vision-API-Key (OPENAI_API_KEY) gesetzt")
  await assertBudget()

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: VISION_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Du extrahierst Kontaktdaten aus Fotos (Visitenkarten, Profil-Screenshots, Kontakt-Ansichten, handschriftliche Notizen). Keine Identifikation realer Personen über die sichtbaren Textdaten hinaus. Antworte als JSON:\n${SCHEMA}`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrahiere alle Kontaktdaten aus diesem Bild." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  })
  if (!res.ok) {
    throw new Error(`Vision-API-Fehler ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  await logUsage({
    provider: "openai",
    model: VISION_MODEL,
    feature: "capture",
    tokensIn: data.usage?.prompt_tokens,
    tokensOut: data.usage?.completion_tokens,
  })
  return normalize(JSON.parse(data.choices?.[0]?.message?.content ?? "{}"))
}

/** Extrahiert Kontaktdaten aus Freitext (z. B. "Anna +43 660 123, anna@x.at, Geb. 12.5."). */
export async function extractContactFromText(raw: string): Promise<CapturedContact> {
  const out = await chatJSON(
    `Du extrahierst Kontaktdaten aus Freitext. Antworte als JSON:\n${SCHEMA}`,
    raw,
    "capture"
  )
  return normalize(JSON.parse(out))
}

function normalize(p: Partial<CapturedContact>): CapturedContact {
  const channels = (Array.isArray(p.channels) ? p.channels : [])
    .filter((c) => c && typeof c.channel === "string" && typeof c.handle === "string" && c.handle.trim())
    .map((c) => ({ channel: c.channel.toLowerCase().trim(), handle: c.handle.trim() }))
  return {
    name: (p.name ?? "").toString().trim() || "Unbekannt",
    kind: ["dating", "freund", "business"].includes(p.kind as string) ? (p.kind as CapturedContact["kind"]) : "unbekannt",
    age: typeof p.age === "number" ? p.age : null,
    location: p.location ?? null,
    language: (p.language ?? "de").toString(),
    birthday: /^\d{4}-\d{2}-\d{2}$/.test(p.birthday ?? "") ? (p.birthday as string) : null,
    company: p.company ?? null,
    bio: p.bio ?? null,
    interests: Array.isArray(p.interests) ? p.interests.filter((x): x is string => typeof x === "string") : [],
    notes: p.notes ?? null,
    tags: Array.isArray(p.tags) ? p.tags.filter((x): x is string => typeof x === "string") : [],
    channels,
  }
}
