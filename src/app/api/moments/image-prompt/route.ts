import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateImagePrompt, type ImagePromptInput } from "@/lib/ai/imagePrompt"

export const maxDuration = 60

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = (await req.json()) as ImagePromptInput & {
    contactId?: string
    eventId?: string
  }

  try {
    const result = await generateImagePrompt(body)
    await supabase.from("moment_assets").insert({
      contact_id: body.contactId ?? null,
      event_id: body.eventId ?? null,
      kind: "image_prompt",
      title: `${body.occasion} · ${body.style}`,
      content: result.prompt,
      meta: {
        negative_prompt: result.negative_prompt,
        caption: result.caption,
        format: body.format,
      },
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI-Fehler" },
      { status: 500 }
    )
  }
}
