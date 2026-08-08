import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { zuCsv } from "@/lib/exportCsv"

/**
 * Daten-Export je Modul als JSON oder CSV — Datenportabilität und
 * DSGVO-Auskunft per Klick statt Handarbeit. Läuft über den Session-Client
 * (RLS), nicht über die Service-Role: exportiert wird nur, was der
 * eingeloggte Account ohnehin lesen darf.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 30

const MODULE: Record<string, { tabelle: "contacts" | "messages" | "memories" | "job_applications" | "events" | "paper_trades"; sortiert: string }> = {
  kontakte: { tabelle: "contacts", sortiert: "created_at" },
  nachrichten: { tabelle: "messages", sortiert: "sent_at" },
  gedaechtnis: { tabelle: "memories", sortiert: "created_at" },
  jobs: { tabelle: "job_applications", sortiert: "created_at" },
  events: { tabelle: "events", sortiert: "created_at" },
  trading: { tabelle: "paper_trades", sortiert: "created_at" },
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const modul = url.searchParams.get("modul") ?? ""
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json"
  const ziel = MODULE[modul]
  if (!ziel) {
    return NextResponse.json(
      { error: `modul muss eines sein von: ${Object.keys(MODULE).join(", ")}` },
      { status: 400 }
    )
  }

  // Seitenweise holen — Supabase kappt bei 1000 Zeilen pro Request
  const zeilen: Record<string, unknown>[] = []
  for (let von = 0; ; von += 1000) {
    const { data, error } = await supabase
      .from(ziel.tabelle)
      .select("*")
      .order(ziel.sortiert, { ascending: true })
      .range(von, von + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    zeilen.push(...((data ?? []) as Record<string, unknown>[]))
    if (!data || data.length < 1000) break
  }

  const datum = new Date().toISOString().slice(0, 10)
  const dateiname = `momentumos-${modul}-${datum}.${format}`

  if (format === "csv") {
    return new NextResponse(zuCsv(zeilen), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${dateiname}"`,
      },
    })
  }
  return NextResponse.json(
    { modul, exportiert_am: new Date().toISOString(), zeilen: zeilen.length, daten: zeilen },
    { headers: { "Content-Disposition": `attachment; filename="${dateiname}"` } }
  )
}
