import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateImagePrompt, type ImagePromptInput } from "@/lib/ai/imagePrompt"
import { generateImage, imageGenerationAvailable } from "@/lib/ai/generateImage"

export const maxDuration = 120

const SIZE: Record<ImagePromptInput["format"], "1024x1024" | "1024x1536" | "1536x1024"> = {
  square: "1024x1024",
  portrait: "1024x1536",
  story: "1024x1536",
  landscape: "1536x1024",
}

/**
 * Erzeugt echtes Bild: baut Prompt (DeepSeek) und generiert das Bild (OpenAI Images),
 * speichert es als Asset. Braucht OPENAI_API_KEY. Ohne Key: 400 mit Hinweis.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  if (!imageGenerationAvailable()) {
    return NextResponse.json(
      { error: "Bild-Generierung nicht aktiv — OPENAI_API_KEY in Vercel setzen. Nutze solange den Bild-Prompt." },
      { status: 400 }
    )
  }

  const body = (await req.json()) as ImagePromptInput & { contactId?: string; eventId?: string; prompt?: string }

  try {
    // Prompt entweder mitgeliefert oder frisch generieren
    let prompt = body.prompt
    let caption = ""
    if (!prompt) {
      const p = await generateImagePrompt(body)
      prompt = p.prompt
      caption = p.caption
    }

    const admin = createAdminClient()
    const { url } = await generateImage(admin, prompt, {
      size: SIZE[body.format ?? "portrait"],
      pathPrefix: body.contactId ?? "moment",
    })

    await supabase.from("moment_assets").insert({
      contact_id: body.contactId ?? null,
      event_id: body.eventId ?? null,
      kind: "image",
      title: `${body.occasion ?? "Bild"} · ${body.style ?? ""}`.trim(),
      content: url,
      meta: { prompt, caption, format: body.format },
    })

    return NextResponse.json({ url, prompt, caption })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bild-Fehler" },
      { status: 500 }
    )
  }
}
