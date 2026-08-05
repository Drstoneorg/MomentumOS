import { NextResponse } from "next/server"
import { createEvents, type EventAttributes } from "ics"
import { createAdminClient } from "@/lib/supabase/admin"
import { slotDatum } from "@/lib/ai/askTools"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * Abonnierbarer Kalender-Feed: Dates, Events, Gigs, Meetups und Geburtstage
 * als ein ICS. Kalender-Apps können keine Cookies, deshalb Token in der URL
 * (settings.calendar_token, in den Einstellungen erzeug- und erneuerbar).
 *
 * Zeiten kommen als UTC mit Z-Suffix raus — die Kalender-App rechnet selbst
 * in die lokale Zeitzone um. Geburtstage sind ganztägig mit FREQ=YEARLY.
 */

/** Nächstes Vorkommen eines Geburtstags als [Jahr, Monat, Tag]. */
function naechsterGeburtstag(birthday: string): [number, number, number] | null {
  const m = birthday.match(/^\d{4}-(\d{2})-(\d{2})/)
  if (!m) return null
  const monat = Number(m[1])
  const tag = Number(m[2])
  let jahr = new Date().getFullYear()
  // Gestern und älter: erst nächstes Jahr wieder. Heute bleibt heute.
  if (Date.UTC(jahr, monat - 1, tag) < Date.now() - 86400_000) jahr += 1
  return [jahr, monat, tag]
}

/** Folgetag als [Jahr, Monat, Tag] — Monats- und Jahreswechsel inklusive. */
function folgetag(j: number, m: number, t: number): [number, number, number] {
  const d = new Date(Date.UTC(j, m - 1, t) + 86400_000)
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]
}

/** Zeitpunkt als UTC-Komponenten fürs ics-Paket. */
function utcTeile(iso: string): [number, number, number, number, number] {
  const d = new Date(iso)
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()]
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")
  if (!token) return NextResponse.json({ error: "token fehlt" }, { status: 401 })

  let db: ReturnType<typeof createAdminClient>
  try {
    db = createAdminClient()
  } catch {
    return NextResponse.json({ error: "Server nicht konfiguriert" }, { status: 500 })
  }

  const { data: setting } = await db
    .from("settings")
    .select("value")
    .eq("key", "calendar_token")
    .maybeSingle()
  if (typeof setting?.value !== "string" || setting.value !== token) {
    return NextResponse.json({ error: "ungültiges Token" }, { status: 401 })
  }

  const seit = new Date(Date.now() - 30 * 86400_000).toISOString()

  const [dates, events, gigs, meetups, kontakte, interviews] = await Promise.all([
    db
      .from("dates")
      .select("starts_at, place, idea, status, contacts(name)")
      .gte("starts_at", seit)
      .order("starts_at")
      .limit(100),
    db.from("events").select("title, starts_at, location, description").gte("starts_at", seit).limit(100),
    db
      .from("gigs")
      .select("title, gig_date, venue, set_slot, status, artists(name)")
      .gte("gig_date", seit.slice(0, 10))
      .neq("status", "cancelled")
      .limit(100),
    db.from("meetups").select("title, status, slots, chosen_slot").neq("status", "cancelled").limit(100),
    db.from("contacts").select("name, birthday").not("birthday", "is", null).limit(400),
    db
      .from("job_applications")
      .select("company, title, interview_at")
      .not("interview_at", "is", null)
      .gte("interview_at", seit)
      .limit(50),
  ])

  const eintraege: EventAttributes[] = []

  for (const d of dates.data ?? []) {
    if (!d.starts_at) continue
    eintraege.push({
      title: `💘 Date mit ${d.contacts?.name ?? "?"}${d.status === "proposed" ? " (vorgeschlagen)" : ""}`,
      start: utcTeile(d.starts_at),
      startInputType: "utc",
      startOutputType: "utc",
      duration: { hours: 2 },
      location: d.place ?? undefined,
      description: d.idea ?? undefined,
    })
  }
  for (const e of events.data ?? []) {
    if (!e.starts_at) continue
    eintraege.push({
      title: `🎉 ${e.title}`,
      start: utcTeile(e.starts_at),
      startInputType: "utc",
      startOutputType: "utc",
      duration: { hours: 5 },
      location: e.location ?? undefined,
      description: e.description ?? undefined,
    })
  }
  for (const g of gigs.data ?? []) {
    if (!g.gig_date) continue
    const [j, m, t] = g.gig_date.split("-").map(Number)
    eintraege.push({
      // Ganztägig: Uhrzeit steckt, wenn erfasst, im Set-Slot-Text
      title: `🎧 ${g.artists?.name ?? "?"}${g.title ? ` — ${g.title}` : ""}`,
      start: [j, m, t],
      end: folgetag(j, m, t),
      location: g.venue ?? undefined,
      description: g.set_slot ? `Set: ${g.set_slot}` : undefined,
    })
  }
  for (const m of meetups.data ?? []) {
    const slot = slotDatum(m.slots, m.chosen_slot)
    if (!slot || slot.when < seit) continue
    eintraege.push({
      title: `👥 ${m.title}`,
      start: utcTeile(slot.when),
      startInputType: "utc",
      startOutputType: "utc",
      duration: { hours: 2 },
      location: slot.place || undefined,
    })
  }
  for (const j of interviews.data ?? []) {
    if (!j.interview_at) continue
    eintraege.push({
      title: `💼 Interview: ${j.company}`,
      start: utcTeile(j.interview_at),
      startInputType: "utc",
      startOutputType: "utc",
      duration: { hours: 1 },
      description: j.title,
    })
  }
  for (const k of kontakte.data ?? []) {
    const start = naechsterGeburtstag(k.birthday as string)
    if (!start) continue
    eintraege.push({
      title: `🎂 ${k.name}`,
      start,
      end: folgetag(...start),
      recurrenceRule: "FREQ=YEARLY",
    })
  }

  if (!eintraege.length) {
    // Leerer Kalender ist gültig — das ics-Paket mag nur keine leere Liste.
    return new NextResponse(
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:momentumos\r\nEND:VCALENDAR\r\n",
      { headers: { "Content-Type": "text/calendar; charset=utf-8" } }
    )
  }
  eintraege[0].calName = "MomentumOS"

  const { error, value } = createEvents(eintraege)
  if (error || value == null) {
    return NextResponse.json({ error: String(error ?? "ICS leer") }, { status: 500 })
  }

  return new NextResponse(value, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="momentumos.ics"',
      "Cache-Control": "private, max-age=900",
    },
  })
}
