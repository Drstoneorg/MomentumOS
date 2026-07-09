import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { assertBudget, logUsage, imageOutputTokens, type ImageSize, type ImageQuality } from "@/lib/ai/usage"

export function imageApiKey(): string | null {
  return process.env.OPENAI_API_KEY || process.env.IMAGE_API_KEY || null
}

export function imageGenerationAvailable(): boolean {
  return !!imageApiKey()
}

// Standardmodell gpt-image-2 (günstiger als gpt-image-1); per IMAGE_MODEL überschreibbar,
// falls OpenAI die Model-ID anders benennt.
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-2"

// Wörter, die OpenAIs Safety-System bei Bild-Prompts häufig blockt (Romantik/Körper/
// Anzüglichkeit). Wird beim Retry entfernt und durch neutrale Begriffe ersetzt.
const RISKY_WORDS = [
  "sexy", "hot", "nude", "naked", "nackt", "lingerie", "dessous", "bikini", "cleavage",
  "seductive", "sensual", "erotic", "erotisch", "kiss", "kissing", "kuss", "küssen",
  "bed", "bett", "bedroom", "schlafzimmer", "romantic", "romantisch", "flirt", "flirty",
  "girlfriend", "boyfriend", "freundin", "freund", "date", "crush", "body", "curves",
  "attractive", "beautiful woman", "beautiful man", "hübsche frau", "hübscher mann",
]

/**
 * Neutralisiert einen Prompt für einen sicheren Retry nach Safety-Ablehnung:
 * entfernt riskante Wörter und rahmt ihn als harmlose, festliche Illustration ohne
 * reale/identifizierbare Personen. Deterministisch (keine KI, keine Extra-Kosten).
 */
export function sanitizeImagePrompt(prompt: string): string {
  let p = prompt
  for (const w of RISKY_WORDS) {
    p = p.replace(new RegExp(`\\b${w}\\b`, "gi"), "")
  }
  p = p.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").trim()
  return `A wholesome, festive illustration. No real or identifiable people, no romantic or suggestive content. ${p}`.slice(0, 1000)
}

// Erkennt eine Safety-/Moderations-Ablehnung von OpenAI (nicht jeden 400).
function isSafetyRejection(status: number, bodyText: string): boolean {
  if (status !== 400) return false
  const t = bodyText.toLowerCase()
  return t.includes("safety system") || t.includes("moderation") || t.includes("content policy") || t.includes("rejected")
}

// Klartext-Fehler für die UI, statt roher OpenAI-Antwort.
export class ImageSafetyError extends Error {
  constructor() {
    super(
      "OpenAI hat den Bild-Prompt aus Sicherheitsgründen abgelehnt — auch nach automatischer Entschärfung. " +
        "Formuliere neutraler: kein echter Name, kein Körper-/Romantik-/Anzüglich-Wording. " +
        "Beispiel: „festliche Geburtstags-Illustration, Kuchen, Konfetti, warme Farben, Anime-Stil“."
    )
  }
}

/**
 * Erzeugt ein Bild über die OpenAI-Images-API (gpt-image-2), lädt es in den
 * öffentlichen Supabase-Storage-Bucket `moment-images` und gibt die URL zurück.
 * Braucht OPENAI_API_KEY (oder IMAGE_API_KEY) in der Umgebung.
 */
export async function generateImage(
  supabase: SupabaseClient<Database>,
  prompt: string,
  opts: { size?: ImageSize; quality?: ImageQuality; pathPrefix?: string } = {}
): Promise<{ url: string }> {
  const key = imageApiKey()
  if (!key) throw new Error("Kein Bild-API-Key (OPENAI_API_KEY) gesetzt")
  await assertBudget()

  const size: ImageSize = opts.size ?? "1024x1024"
  const quality: ImageQuality = opts.quality ?? "low"

  async function callApi(p: string) {
    return fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt: p, size, quality, n: 1 }),
    })
  }

  let res = await callApi(prompt)
  // Bei Safety-Ablehnung einmal automatisch mit entschärftem Prompt neu versuchen.
  if (!res.ok) {
    const bodyText = await res.text()
    if (isSafetyRejection(res.status, bodyText)) {
      res = await callApi(sanitizeImagePrompt(prompt))
      if (!res.ok) {
        const t2 = await res.text()
        if (isSafetyRejection(res.status, t2)) throw new ImageSafetyError()
        throw new Error(`Bild-API-Fehler ${res.status}: ${t2.slice(0, 200)}`)
      }
    } else {
      throw new Error(`Bild-API-Fehler ${res.status}: ${bodyText.slice(0, 200)}`)
    }
  }
  const data = (await res.json()) as {
    data?: { b64_json?: string; url?: string }[]
  }
  const b64 = data.data?.[0]?.b64_json
  const remoteUrl = data.data?.[0]?.url
  let bytes: Uint8Array

  if (b64) {
    bytes = Buffer.from(b64, "base64")
  } else if (remoteUrl) {
    bytes = new Uint8Array(await (await fetch(remoteUrl)).arrayBuffer())
  } else {
    throw new Error("Bild-API lieferte kein Bild")
  }
  // Kosten immer aus der Stufen-Tabelle (Größe×Qualität) — das usage-Feld des
  // Bild-Endpunkts zählt nur Text-Tokens und würde die Render-Kosten grob unterschätzen.
  await logUsage({
    provider: "openai",
    model: IMAGE_MODEL,
    feature: "image",
    images: 1,
    tokensOut: imageOutputTokens(size, quality),
  })

  const path = `${opts.pathPrefix ?? "moment"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
  const { error } = await supabase.storage
    .from("moment-images")
    .upload(path, bytes, { contentType: "image/png", upsert: false })
  if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`)

  const { data: pub } = supabase.storage.from("moment-images").getPublicUrl(path)
  return { url: pub.publicUrl }
}

/**
 * Bild-Bearbeitung über die OpenAI-Images-Edits-API: nimmt ein Referenzbild
 * (z. B. TCG-Kartenvorlage) und einen Prompt, behält Rahmen/Layout und ersetzt
 * Inhalt laut Prompt. Ergebnis landet wie generateImage im Storage.
 */
export async function editImage(
  supabase: SupabaseClient<Database>,
  prompt: string,
  referenceImageUrl: string,
  opts: { size?: ImageSize; quality?: ImageQuality; pathPrefix?: string } = {}
): Promise<{ url: string }> {
  const key = imageApiKey()
  if (!key) throw new Error("Kein Bild-API-Key (OPENAI_API_KEY) gesetzt")
  await assertBudget()

  const size: ImageSize = opts.size ?? "1024x1024"
  const quality: ImageQuality = opts.quality ?? "low"

  const refRes = await fetch(referenceImageUrl)
  if (!refRes.ok) throw new Error(`Referenzbild nicht ladbar (${refRes.status})`)
  const refBlob = await refRes.blob()

  async function callApi(p: string) {
    const form = new FormData()
    form.append("model", IMAGE_MODEL)
    form.append("prompt", p)
    form.append("size", size)
    form.append("quality", quality)
    form.append("n", "1")
    form.append("image", refBlob, "reference.png")
    return fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    })
  }

  let res = await callApi(prompt)
  if (!res.ok) {
    const bodyText = await res.text()
    if (isSafetyRejection(res.status, bodyText)) {
      res = await callApi(sanitizeImagePrompt(prompt))
      if (!res.ok) {
        const t2 = await res.text()
        if (isSafetyRejection(res.status, t2)) throw new ImageSafetyError()
        throw new Error(`Bild-API-Fehler ${res.status}: ${t2.slice(0, 200)}`)
      }
    } else {
      throw new Error(`Bild-API-Fehler ${res.status}: ${bodyText.slice(0, 200)}`)
    }
  }
  const data = (await res.json()) as { data?: { b64_json?: string; url?: string }[] }
  const b64 = data.data?.[0]?.b64_json
  const remoteUrl = data.data?.[0]?.url
  let bytes: Uint8Array
  if (b64) {
    bytes = Buffer.from(b64, "base64")
  } else if (remoteUrl) {
    bytes = new Uint8Array(await (await fetch(remoteUrl)).arrayBuffer())
  } else {
    throw new Error("Bild-API lieferte kein Bild")
  }
  await logUsage({
    provider: "openai",
    model: IMAGE_MODEL,
    feature: "image",
    images: 1,
    tokensOut: imageOutputTokens(size, quality),
  })

  const path = `${opts.pathPrefix ?? "edit"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
  const { error } = await supabase.storage
    .from("moment-images")
    .upload(path, bytes, { contentType: "image/png", upsert: false })
  if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`)

  const { data: pub } = supabase.storage.from("moment-images").getPublicUrl(path)
  return { url: pub.publicUrl }
}
