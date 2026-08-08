import type { Metadata } from "next"
import QRCode from "qrcode"
import { createAdminClient } from "@/lib/supabase/admin"
import { zusagenMitBegleitung } from "@/lib/inviteScore"
import { SITE_URL } from "@/lib/siteUrl"
import { RsvpForm } from "./RsvpForm"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Einladung", robots: { index: false } }

/** Außerhalb der Komponente wegen react-hooks/purity (Date.now im Render). */
function istVergangen(startsAt: string | null): boolean {
  return !!startsAt && Date.now() > new Date(startsAt).getTime() + 6 * 3600_000
}

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
    companion_names: string | null
    comment: string | null
    feedback_rating: number | null
    contacts: { name: string; language: string | null } | null
    events: {
      id: string
      title: string
      starts_at: string | null
      location: string | null
      description: string | null
      ticket_url: string | null
      capacity: number | null
    } | null
  } | null = null
  let voll = false

  if (/^[a-f0-9]{32}$/.test(token)) {
    try {
      const admin = createAdminClient()
      const { data } = await admin
        .from("event_invites")
        .select(
          "id, status, plus_ones, promo_code, companion_names, comment, feedback_rating, contacts(name, language), events(id, title, starts_at, location, description, ticket_url, capacity)"
        )
        .eq("rsvp_token", token)
        .maybeSingle()
      invite = data

      // Volles Haus? Zusagen aller Gäste gegen die Kapazität
      if (invite?.events?.capacity) {
        const { data: alle } = await admin
          .from("event_invites")
          .select("status, plus_ones")
          .eq("event_id", invite.events.id)
        voll = zusagenMitBegleitung(alle ?? []).gesamt >= invite.events.capacity
      }
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

  // Nach dem Event (6h Puffer) wird die Seite zur 1-Frage-Feedback-Karte
  const vergangen = istVergangen(event.starts_at)

  // Einlass-QR: der persönliche Link als Code — Tür-Modus scannt ihn
  let qrDataUrl: string | null = null
  try {
    qrDataUrl = await QRCode.toDataURL(`${SITE_URL}/einladung/${token}`, {
      width: 384,
      margin: 1,
    })
  } catch {
    qrDataUrl = null
  }

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
          voll={voll}
          vergangen={vergangen}
          companionNames={invite.companion_names}
          comment={invite.comment}
          feedbackRating={invite.feedback_rating}
          startLang={invite.contacts?.language === "en" ? "en" : "de"}
          qrDataUrl={qrDataUrl}
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
