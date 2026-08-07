import type { Metadata } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { RsvpForm } from "./RsvpForm"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Einladung", robots: { index: false } }

/**
 * Öffentliche Einladungs-Seite aus Gast-Sicht: Event hübsch, ein Tap zum
 * Zusagen. Kein Login — der Token in der URL ist die Berechtigung und zeigt
 * genau EINE Einladung. Ohne gültigen Token gibt es nur eine neutrale Meldung,
 * keine Event-Daten.
 */
export default async function EinladungPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  let invite: {
    id: string
    status: string
    plus_ones: number
    promo_code: string | null
    contacts: { name: string } | null
    events: {
      id: string
      title: string
      starts_at: string | null
      location: string | null
      description: string | null
      ticket_url: string | null
    } | null
  } | null = null

  if (/^[a-f0-9]{32}$/.test(token)) {
    try {
      const admin = createAdminClient()
      const { data } = await admin
        .from("event_invites")
        .select(
          "id, status, plus_ones, promo_code, contacts(name), events(id, title, starts_at, location, description, ticket_url)"
        )
        .eq("rsvp_token", token)
        .maybeSingle()
      invite = data
    } catch {
      invite = null
    }
  }

  if (!invite?.events) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <span className="text-4xl">🖤</span>
        <h1 className="mt-4 text-xl font-bold text-white">Einladung nicht gefunden</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Der Link ist unvollständig oder nicht mehr gültig. Frag am besten kurz bei der Person
          nach, die dich eingeladen hat.
        </p>
      </div>
    )
  }

  const event = invite.events
  const vorname = invite.contacts?.name?.trim().split(/\s+/)[0]

  // Lineup: bestätigte Gigs dieses Events als kleine Zeile
  let lineup: string[] = []
  try {
    const admin = createAdminClient()
    const { data: gigs } = await admin
      .from("gigs")
      .select("set_slot, status, artists(name)")
      .eq("event_id", event.id)
      .in("status", ["confirmed", "contracted", "played"])
    lineup = (gigs ?? []).map((g) => g.artists?.name).filter((n): n is string => !!n)
  } catch {
    /* ohne Lineup geht es auch */
  }

  const datum = event.starts_at
    ? new Date(event.starts_at).toLocaleString("de-DE", { dateStyle: "full", timeStyle: "short" })
    : "Datum folgt"

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400">
        {vorname ? `${vorname}, du bist eingeladen` : "Du bist eingeladen"}
      </p>
      <h1 className="mt-2 text-3xl font-bold leading-tight text-white">{event.title}</h1>
      <p className="mt-3 text-sm text-zinc-300">
        📅 {datum}
        {event.location && (
          <>
            <br />📍 {event.location}
          </>
        )}
      </p>
      {event.description && <p className="mt-4 text-sm leading-relaxed text-zinc-400">{event.description}</p>}
      {lineup.length > 0 && (
        <p className="mt-3 text-sm text-zinc-400">
          🎧 <span className="text-zinc-200">{lineup.join(" · ")}</span>
        </p>
      )}

      <div className="mt-8">
        <RsvpForm
          token={token}
          status={invite.status}
          plusOnes={invite.plus_ones ?? 0}
          statusFinal={["ticket", "attended"].includes(invite.status)}
        />
      </div>

      {(event.ticket_url || invite.promo_code) && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm">
          {event.ticket_url && (
            <a
              href={event.ticket_url}
              className="font-medium text-fuchsia-300 underline underline-offset-2"
              rel="noopener noreferrer"
              target="_blank"
            >
              🎟 Tickets holen
            </a>
          )}
          {invite.promo_code && (
            <p className="mt-1 text-zinc-300">
              Dein Code: <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-white">{invite.promo_code}</span>
            </p>
          )}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-zinc-600">
        Persönliche Einladung — dieser Link gehört nur dir
      </p>
    </div>
  )
}
