import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { RSVP_LABELS } from "@/lib/dbLabels"

export const dynamic = "force-dynamic"

/** CSV-Feld escapen: Anführungszeichen verdoppeln, Feld quoten wenn nötig. */
function csvField(v: string | null | undefined): string {
  const s = (v ?? "").replace(/\r?\n/g, " ")
  return /[";,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Gästeliste als CSV — für die Tür am Event (ausdrucken oder am Handy).
 * Sortiert: Ticket zuerst, dann Zusagen, dann Rest. Semikolon-getrennt,
 * damit Excel (DE-Locale) die Datei direkt richtig öffnet.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const [eventRes, invitesRes] = await Promise.all([
    supabase.from("events").select("title, starts_at").eq("id", id).single(),
    supabase
      .from("event_invites")
      .select("status, promo_code, contacts(name, realm, platform, contact_channels(channel, handle))")
      .eq("event_id", id),
  ])
  if (!eventRes.data) return NextResponse.json({ error: "not found" }, { status: 404 })

  const order: Record<string, number> = { ticket: 0, attended: 0, yes: 1, maybe: 2, invited: 3, no: 4 }
  const rows = (invitesRes.data ?? []).sort(
    (a, b) =>
      (order[a.status] ?? 9) - (order[b.status] ?? 9) ||
      (a.contacts?.name ?? "").localeCompare(b.contacts?.name ?? "")
  )

  const lines = ["Name;Herkunft;Status;Promo-Code;Kanal"]
  for (const inv of rows) {
    const c = inv.contacts
    const herkunft = c?.realm === "moment" ? "Freunde" : c?.platform || "unbekannt"
    const kanal = c?.contact_channels?.[0]
      ? `${c.contact_channels[0].channel}: ${c.contact_channels[0].handle}`
      : ""
    lines.push(
      [
        csvField(c?.name),
        csvField(herkunft),
        csvField(RSVP_LABELS[inv.status] ?? inv.status),
        csvField(inv.promo_code),
        csvField(kanal),
      ].join(";")
    )
  }

  const slug = eventRes.data.title.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").slice(0, 40)
  // BOM, damit Excel Umlaute als UTF-8 erkennt
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gaesteliste-${slug || "event"}.csv"`,
    },
  })
}
