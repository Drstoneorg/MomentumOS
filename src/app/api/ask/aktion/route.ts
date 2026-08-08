import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Führt eine im Frage-Chat vorgeschlagene Schreib-Aktion aus — NACH dem
 * Bestätigungs-Klick. Harte Whitelist, Session-Client (RLS greift), keine
 * freien Queries: das Modell liefert nur Parameter, nie SQL.
 */

export const maxDuration = 15

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "")
const istUuid = (v: string) => /^[0-9a-f-]{36}$/.test(v)

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let body: { aktion?: unknown; params?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 })
  }
  const aktion = str(body.aktion)
  const params = (body.params ?? {}) as Record<string, unknown>

  try {
    if (aktion === "kontakt_anlegen") {
      const name = str(params.name).slice(0, 80)
      const realm = params.realm === "match" ? "match" : "moment"
      if (!name) return NextResponse.json({ error: "Name fehlt" }, { status: 400 })
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          name,
          realm,
          platform: "ask",
          pipeline_stage: realm === "match" ? "new_match" : "chatting",
        })
        .select("id")
        .single()
      if (error || !data) throw new Error(error?.message ?? "Anlegen fehlgeschlagen")
      return NextResponse.json({ ok: true, text: `Kontakt „${name}" angelegt`, href: `/contacts/${data.id}` })
    }

    if (aktion === "notiz_speichern") {
      const kontaktId = str(params.kontakt_id)
      const text = str(params.text).slice(0, 500)
      if (!istUuid(kontaktId) || !text) {
        return NextResponse.json({ error: "Kontakt oder Text fehlt" }, { status: 400 })
      }
      const { error } = await supabase
        .from("memories")
        .insert({ contact_id: kontaktId, kind: "fact", content: text })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, text: "Notiz gespeichert", href: `/contacts/${kontaktId}` })
    }

    if (aktion === "wiedervorlage") {
      const kontaktId = str(params.kontakt_id)
      const tage = Math.min(365, Math.max(1, Math.round(Number(params.in_tagen) || 3)))
      const grund = str(params.grund).slice(0, 200) || "melden"
      if (!istUuid(kontaktId)) return NextResponse.json({ error: "Kontakt fehlt" }, { status: 400 })
      const due = new Date(Date.now() + tage * 86400_000)
      due.setHours(9, 0, 0, 0)
      const { error } = await supabase.from("reminders").insert({
        kind: "wiedervorlage",
        contact_id: kontaktId,
        due_at: due.toISOString(),
        note: grund,
      })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, text: `Wiedervorlage in ${tage} Tagen gesetzt` })
    }

    if (aktion === "rsvp_setzen") {
      const inviteId = str(params.invite_id)
      const eventId = str(params.event_id)
      const status = params.status === "no" ? "no" : params.status === "yes" ? "yes" : null
      if (!istUuid(inviteId) || !istUuid(eventId) || !status) {
        return NextResponse.json({ error: "Unvollständige Parameter" }, { status: 400 })
      }
      const { error } = await supabase
        .from("event_invites")
        .update({ status })
        .eq("id", inviteId)
        .eq("event_id", eventId)
      if (error) throw new Error(error.message)
      return NextResponse.json({
        ok: true,
        text: `Auf ${status === "yes" ? "Zusage" : "Absage"} gesetzt`,
        href: `/moments/events/${eventId}/einladen`,
      })
    }

    return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ausführen fehlgeschlagen" },
      { status: 500 }
    )
  }
}
