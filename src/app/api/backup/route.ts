import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Voll-Export aller App-Tabellen als JSON — für den täglichen Backup-Workflow
 * (GitHub Action lädt das Ergebnis als Artifact hoch, siehe BACKUP.md).
 * Auth: Authorization: Bearer <BACKUP_SECRET>. Ohne gesetztes Secret keine Antwort.
 */

// Alle App-Tabellen (ohne PostGIS-Systemtabellen). Neue Tabellen hier ergänzen,
// sonst fehlen sie im Backup.
const TABLES = [
  "ai_usage",
  "asset_sends",
  "booking_offers",
  "bookings",
  "card_templates",
  "contact_channels",
  "contacts",
  "conversation_summaries",
  "dates",
  "event_invites",
  "events",
  "followups",
  "job_applications",
  "meetup_participants",
  "meetups",
  "memories",
  "messages",
  "moment_assets",
  "occasions",
  "providers",
  "push_subscriptions",
  "reply_feedback",
  "reviews",
  "settings",
  "suggestions",
  "treatments",
] as const

export async function GET(req: Request) {
  const secret = process.env.BACKUP_SECRET
  const auth = req.headers.get("authorization")
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const tables: Record<string, unknown[]> = {}

  for (const table of TABLES) {
    const rows: unknown[] = []
    // Supabase liefert max 1000 Zeilen pro Request — seitenweise holen.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from(table).select("*").range(from, from + 999)
      if (error) {
        return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 })
      }
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    tables[table] = rows
  }

  const totalRows = Object.values(tables).reduce((n, rows) => n + rows.length, 0)
  return NextResponse.json(
    { generated_at: new Date().toISOString(), table_count: TABLES.length, total_rows: totalRows, tables },
    {
      headers: {
        "Content-Disposition": `attachment; filename="matchos-backup-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    }
  )
}
