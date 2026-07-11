import { NextResponse } from "next/server"
import { authExtension } from "@/lib/extensionAuth"
import { loadContactContext } from "@/lib/ai/context"
import { rephraseInMyStyle } from "@/lib/ai/rephrase"

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

  const { contactId, idea, nowLocal } = await req.json()
  if (!idea?.trim()) {
    return NextResponse.json({ error: "Idee fehlt" }, { status: 400, headers: cors })
  }
  const ctx = await loadContactContext(contactId, supabase)
  if (!ctx) {
    return NextResponse.json({ error: "contact not found" }, { status: 404, headers: cors })
  }

  try {
    const result = await rephraseInMyStyle(ctx, idea.trim(), nowLocal)
    return NextResponse.json(result, { headers: cors })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI-Fehler" },
      { status: 500, headers: cors }
    )
  }
}
