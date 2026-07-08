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

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      size,
      quality,
      n: 1,
    }),
  })
  if (!res.ok) {
    throw new Error(`Bild-API-Fehler ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    data?: { b64_json?: string; url?: string }[]
    usage?: { input_tokens?: number; output_tokens?: number }
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
  // Echte Tokens aus der API bevorzugen; sonst Größe×Qualität aus Tabelle schätzen.
  await logUsage({
    provider: "openai",
    model: IMAGE_MODEL,
    feature: "image",
    images: 1,
    tokensIn: data.usage?.input_tokens ?? 0,
    tokensOut: data.usage?.output_tokens ?? imageOutputTokens(size, quality),
  })

  const path = `${opts.pathPrefix ?? "moment"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
  const { error } = await supabase.storage
    .from("moment-images")
    .upload(path, bytes, { contentType: "image/png", upsert: false })
  if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`)

  const { data: pub } = supabase.storage.from("moment-images").getPublicUrl(path)
  return { url: pub.publicUrl }
}
