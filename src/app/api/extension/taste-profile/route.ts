import { NextResponse } from "next/server"
import { authExtension } from "@/lib/extensionAuth"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

export async function GET(req: Request) {
  const supabase = await authExtension(req)
  if (supabase === "rate_limited") {
    return NextResponse.json({ error: "Rate-Limit erreicht — in einer Stunde wieder" }, { status: 429, headers: cors })
  }
  if (!supabase) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: cors })
  }
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "taste_profile")
    .maybeSingle()

  const v = (data?.value ?? {}) as { include?: string[]; avoid?: string[]; autoLikeHint?: boolean }
  return NextResponse.json(
    {
      include: Array.isArray(v.include) ? v.include : [],
      avoid: Array.isArray(v.avoid) ? v.avoid : [],
      autoLikeHint: v.autoLikeHint !== false,
    },
    { headers: cors }
  )
}
