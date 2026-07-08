import { NextResponse } from "next/server"
import { authExtension } from "@/lib/extensionAuth"
import { analyzePhoto, visionAvailable } from "@/lib/ai/vision"

export const maxDuration = 60

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

// Foto-Check für die Browser-Extension: nimmt eine Bild-URL vom Profil, prüft gegen Beuteschema.
export async function POST(req: Request) {
  const supabase = await authExtension(req)
  if (!supabase) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: cors })
  }
  if (!visionAvailable()) {
    return NextResponse.json({ error: "no_vision_key" }, { status: 503, headers: cors })
  }

  const { imageUrl } = await req.json()
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "Kein Bild" }, { status: 400, headers: cors })
  }

  const { data: settings } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "taste_profile")
    .maybeSingle()
  const v = (settings?.value ?? {}) as { include?: string[]; avoid?: string[] }

  try {
    const verdict = await analyzePhoto(
      { url: imageUrl },
      { include: v.include ?? [], avoid: v.avoid ?? [] }
    )
    return NextResponse.json(verdict, { headers: cors })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analyse-Fehler" },
      { status: 500, headers: cors }
    )
  }
}
