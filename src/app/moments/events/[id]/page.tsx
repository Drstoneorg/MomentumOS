import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui"
import { EventInviteManager } from "./EventInviteManager"
import { EventBudget } from "./EventBudget"
import { EventLineup } from "./EventLineup"

export const dynamic = "force-dynamic"

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [eventRes, invitesRes, contactsRes, gigsRes] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).single(),
    supabase.from("event_invites").select("*, contacts(name, realm, platform, relationship_tags, language, contact_channels(channel, handle))").eq("event_id", id),
    // Beide Realms: Freunde UND Matches (Event-Leads) einladbar, Freunde zuerst
    supabase.from("contacts").select("id, name, realm, relationship_tags").order("realm", { ascending: false }).order("name"),
    supabase.from("gigs").select("id, artist_id, fee_cents, status, set_slot, artists(name)").eq("event_id", id),
  ])

  const event = eventRes.data
  if (!event) notFound()

  // Funnel pro Herkunftsplattform: welche App liefert Zusagen und Tickets.
  const invites = invitesRes.data ?? []
  const byPlatform = new Map<
    string,
    { invited: number; yes: number; ticket: number; attended: number }
  >()
  for (const inv of invites) {
    const platform = inv.contacts?.realm === "moment" ? "Freunde" : inv.contacts?.platform || "unbekannt"
    const row = byPlatform.get(platform) ?? { invited: 0, yes: 0, ticket: 0, attended: 0 }
    row.invited++
    if (["yes", "ticket", "attended"].includes(inv.status)) row.yes++
    if (["ticket", "attended"].includes(inv.status)) row.ticket++
    if (inv.status === "attended") row.attended++
    byPlatform.set(platform, row)
  }
  const platformFunnel = [...byPlatform.entries()].sort((a, b) => b[1].invited - a[1].invited)

  // Budget + Lineup: Gigs aus dem BookOS-Artist-Booking dieses Events
  const gigs = (gigsRes.data ?? []).map((g) => ({
    id: g.id,
    artist_id: g.artist_id,
    artistName: g.artists?.name ?? "?",
    fee_cents: g.fee_cents,
    status: g.status,
    set_slot: g.set_slot,
  }))
  const ticketsSold = invites.filter((i) => ["ticket", "attended"].includes(i.status)).length

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-xl font-bold">{event.title}</h1>
        <p className="text-sm text-zinc-400">
          {event.starts_at ? new Date(event.starts_at).toLocaleString("de-DE", { dateStyle: "full", timeStyle: "short" }) : "Datum offen"}
          {event.location ? ` · ${event.location}` : ""}
          {event.capacity ? ` · Kapazität ${event.capacity}` : ""}
        </p>
        {event.description && <p className="mt-2 text-sm text-zinc-300">{event.description}</p>}
        <div className="mt-3">
          <a
            href={`/api/events/${id}/guestlist`}
            className="inline-block rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
            download
          >
            📋 Gästeliste als CSV (Türliste mit Promo-Codes)
          </a>
        </div>
      </Card>

      <EventBudget
        eventId={id}
        ticketPriceCents={event.ticket_price_cents}
        otherCostsCents={event.other_costs_cents}
        ticketsSold={ticketsSold}
        gigs={gigs}
      />

      <EventLineup gigs={gigs} />

      {platformFunnel.length > 1 && (
        <Card title="📊 Funnel pro Plattform — wo kommen die Gäste her?">
          <table className="w-full text-xs">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-1">Herkunft</th>
                <th className="py-1 text-right">Eingeladen</th>
                <th className="py-1 text-right">Zugesagt</th>
                <th className="py-1 text-right">🎟 Ticket</th>
                <th className="py-1 text-right">✔ Da</th>
              </tr>
            </thead>
            <tbody>
              {platformFunnel.map(([platform, r]) => (
                <tr key={platform} className="border-t border-zinc-800/60">
                  <td className="py-1 text-zinc-200">{platform}</td>
                  <td className="py-1 text-right text-zinc-400">{r.invited}</td>
                  <td className="py-1 text-right text-emerald-300">{r.yes}</td>
                  <td className="py-1 text-right text-violet-300">{r.ticket}</td>
                  <td className="py-1 text-right text-zinc-200">{r.attended}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <EventInviteManager
        eventId={id}
        eventTitle={event.title}
        invites={invitesRes.data ?? []}
        allContacts={contactsRes.data ?? []}
      />
    </div>
  )
}
