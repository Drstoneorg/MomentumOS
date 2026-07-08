import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { analyzePhoto, visionAvailable } from "@/lib/ai/vision"

export const maxDuration = 60

// Foto gegen Beuteschema prüfen (in-App, Cookie-Auth).
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  if (!visionAvailable()) {
    return NextResponse.json(
      { error: "Kein Vision-API-Key gesetzt (OPENAI_API_KEY)." },
      { status: 503 }
    )
  }

  const { imageUrl, dataUrl } = await req.json()
  if (!imageUrl && !dataUrl) {
    return NextResponse.json({ error: "Kein Bild übergeben" }, { status: 400 })
  }

  const { data: settings } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "taste_profile")
    .maybeSingle()
  const v = (settings?.value ?? {}) as { include?: string[]; avoid?: string[] }

  try {
    const verdict = await analyzePhoto(
      { url: imageUrl, dataUrl },
      { include: v.include ?? [], avoid: v.avoid ?? [] }
    )
    return NextResponse.json(verdict)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analyse-Fehler" },
      { status: 500 }
    )
  }
}
