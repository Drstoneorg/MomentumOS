import type { Metadata } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { LeadForm } from "./LeadForm"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Event" }

/**
 * Öffentliche Event-Seite unter /e/[slug] — der teilbare Link für Insta-Bio
 * und Story, ohne persönlichen Token. Zeigt Event-Basics + Lineup + Ticket-
 * Link und nimmt „Will kommen"-Interessenten als Lead in die Gästeliste auf.
 * Nur Events mit gesetztem public_slug sind erreichbar; alles andere bleibt zu.
 */
export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let event: {
    id: string
    title: string
    starts_at: string | null
    location: string | null
    description: string | null
    ticket_url: string | null
  } | null = null
  let lineup: string[] = []

  if (/^[a-z0-9-]{1,60}$/.test(slug)) {
    try {
      const admin = createAdminClient()
      const { data } = await admin
        .from("events")
        .select("id, title, starts_at, location, description, ticket_url")
        .eq("public_slug", slug)
        .maybeSingle()
      event = data
      if (event) {
        const { data: gigs } = await admin
          .from("gigs")
          .select("status, artists(name)")
          .eq("event_id", event.id)
          .in("status", ["confirmed", "contracted", "played"])
        lineup = (gigs ?? []).map((g) => g.artists?.name).filter((n): n is string => !!n)
      }
    } catch {
      event = null
    }
  }

  if (!event) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <span className="text-4xl">🖤</span>
        <h1 className="mt-4 text-xl font-bold text-white">Event nicht gefunden</h1>
        <p className="mt-2 text-sm text-zinc-400">Der Link ist nicht mehr aktuell</p>
      </div>
    )
  }

  const datum = event.starts_at
    ? new Date(event.starts_at).toLocaleString("de-DE", { dateStyle: "full", timeStyle: "short" })
    : "Datum folgt"

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400">Event</p>
      <h1 className="mt-2 text-3xl font-bold leading-tight text-white">{event.title}</h1>
      <p className="mt-3 text-sm text-zinc-300">
        📅 {datum}
        {event.location && (
          <>
            <br />📍 {event.location}
          </>
        )}
      </p>
      {event.description && (
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">{event.description}</p>
      )}
      {lineup.length > 0 && (
        <p className="mt-3 text-sm text-zinc-400">
          🎧 <span className="text-zinc-200">{lineup.join(" · ")}</span>
        </p>
      )}

      {event.ticket_url && (
        <a
          href={event.ticket_url}
          className="mt-6 block rounded-xl bg-fuchsia-700 px-4 py-3 text-center text-base font-semibold text-white hover:bg-fuchsia-600"
          rel="noopener noreferrer"
          target="_blank"
        >
          🎟 Tickets holen
        </a>
      )}

      <div className="mt-8">
        <LeadForm slug={slug} />
      </div>
    </div>
  )
}
