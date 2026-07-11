import { NextResponse } from "next/server"
import { authExtension } from "@/lib/extensionAuth"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

export async function POST(req: Request) {
  const supabase = await authExtension(req)
  if (supabase === "rate_limited") {
    return NextResponse.json({ error: "Rate-Limit erreicht — in einer Stunde wieder" }, { status: 429, headers: cors })
  }
  if (!supabase) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: cors })
  }

  const { contactId, style, text, rating } = await req.json()
  if (!text || (rating !== 1 && rating !== -1)) {
    return NextResponse.json(
      { error: "text + rating (1|-1) nötig" },
      { status: 400, headers: cors }
    )
  }

  const { error } = await supabase.from("reply_feedback").insert({
    contact_id: contactId ?? null,
    style: style ?? null,
    content: String(text),
    rating,
    source: "extension",
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
  return NextResponse.json({ ok: true }, { headers: cors })
}
