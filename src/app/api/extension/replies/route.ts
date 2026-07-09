import { NextResponse } from "next/server"
import { authExtension } from "@/lib/extensionAuth"
import { loadContactContext } from "@/lib/ai/context"
import { generateReplies } from "@/lib/ai/generateReplies"

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
  if (!supabase) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: cors })
  }

  const { contactId, situation, nowLocal } = await req.json()
  const ctx = await loadContactContext(contactId, supabase)
  if (!ctx) {
    return NextResponse.json({ error: "contact not found" }, { status: 404, headers: cors })
  }

  try {
    const result = await generateReplies(ctx, situation ?? "", nowLocal)
    return NextResponse.json(result, { headers: cors })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI-Fehler" },
      { status: 500, headers: cors }
    )
  }
}
