import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui"
import { EventInviteManager } from "./EventInviteManager"

export const dynamic = "force-dynamic"

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [eventRes, invitesRes, contactsRes] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).single(),
    supabase.from("event_invites").select("*, contacts(name, relationship_tags, language, contact_channels(channel, handle))").eq("event_id", id),
    supabase.from("contacts").select("id, name, relationship_tags").order("name"),
  ])

  const event = eventRes.data
  if (!event) notFound()

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
      </Card>

      <EventInviteManager
        eventId={id}
        eventTitle={event.title}
        invites={invitesRes.data ?? []}
        allContacts={contactsRes.data ?? []}
      />
    </div>
  )
}
