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
  if (supabase === "rate_limited") {
    return NextResponse.json({ error: "Rate-Limit erreicht — in einer Stunde wieder" }, { status: 429, headers: cors })
  }
  if (!supabase) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: cors })
  }

  const { contactId, situation, liveChat, nowLocal } = await req.json()
  const ctx = await loadContactContext(contactId, supabase)
  if (!ctx) {
    return NextResponse.json({ error: "contact not found" }, { status: 404, headers: cors })
  }

  try {
    // Live-Chat aus dem Browser-DOM hat Vorrang vor evtl. veraltetem DB-Stand:
    // die KI soll immer auf die tatsächlich letzte Nachricht der Person antworten.
    const parts = [situation]
    if (typeof liveChat === "string" && liveChat.trim()) {
      parts.push(
        `Aktueller Chat-Ausschnitt direkt aus dem Browser ([me]=ich, [them]=Person):\n${liveChat
          .trim()
          .slice(0, 2000)}\nAntworte auf die letzte [them]-Nachricht.`
      )
    }
    const result = await generateReplies(ctx, parts.filter(Boolean).join("\n\n"), nowLocal)
    return NextResponse.json(result, { headers: cors })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI-Fehler" },
      { status: 500, headers: cors }
    )
  }
}
