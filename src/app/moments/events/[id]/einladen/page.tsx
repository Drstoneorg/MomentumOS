import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { gastScore } from "@/lib/inviteScore"
import { zusagenMitBegleitung } from "@/lib/inviteScore"
import { InviteAssistant, type Eingeladen, type Kandidat } from "./InviteAssistant"

export const dynamic = "force-dynamic"

/** Wer ist seit 3+ Tagen ohne Antwort und nicht frisch erinnert — außerhalb der Komponente wegen react-hooks/purity. */
function zaehleNachfassFaellige(eingeladen: Eingeladen[]): number {
  const grenze = new Date(Date.now() - 3 * 86400_000).toISOString()
  const sperre = new Date(Date.now() - 4 * 86400_000).toISOString()
  return eingeladen.filter(
    (i) =>
      ["invited", "no_reply"].includes(i.status) &&
      i.created_at < grenze &&
      (!i.last_nudge_at || i.last_nudge_at < sperre)
  ).length
}

/**
 * Einladungs-Assistent: alle Kontakte (Freunde, Matches, Recruit) nach Passung
 * zum Event sortiert, Historie über frühere Events fließt als Ermüdungsschutz
 * bzw. Zuverlässigkeits-Bonus ein.
 */
export default async function EinladenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: event }, { data: contacts }, { data: invites }, { data: historie }] =
    await Promise.all([
      supabase.from("events").select("id, title, starts_at, location, audience, capacity, target_attendees").eq("id", id).maybeSingle(),
      supabase
        .from("contacts")
        .select("id, name, realm, intent, location, relationship_tags, interests, avatar_url")
        .neq("pipeline_stage", "archived")
        .order("name"),
      supabase
        .from("event_invites")
        .select("id, contact_id, status, wave, plus_ones, rsvp_token, created_at, last_nudge_at, contacts(name)")
        .eq("event_id", id)
        .order("created_at"),
      supabase.from("event_invites").select("contact_id, status"),
    ])
  if (!event) notFound()

  // Historie pro Kontakt über ALLE Events: wie oft eingeladen, wie oft reagiert
  const hist = new Map<string, { eingeladen: number; reagiert: number }>()
  for (const h of historie ?? []) {
    const e = hist.get(h.contact_id) ?? { eingeladen: 0, reagiert: 0 }
    e.eingeladen++
    if (["yes", "no", "ticket", "attended"].includes(h.status)) e.reagiert++
    hist.set(h.contact_id, e)
  }

  const eingeladenIds = new Set((invites ?? []).map((i) => i.contact_id))
  const kandidaten: Kandidat[] = (contacts ?? [])
    .filter((c) => !eingeladenIds.has(c.id))
    .map((c) => {
      const { score, gruende } = gastScore(c, event, hist.get(c.id) ?? { eingeladen: 0, reagiert: 0 })
      return { id: c.id, name: c.name, realm: c.realm, avatar_url: c.avatar_url, score, gruende }
    })
    .sort((a, b) => b.score - a.score)

  const eingeladen: Eingeladen[] = (invites ?? []).map((i) => ({
    id: i.id,
    contact_id: i.contact_id,
    name: i.contacts?.name ?? "?",
    status: i.status,
    wave: i.wave ?? 1,
    plus_ones: i.plus_ones ?? 0,
    rsvp_token: i.rsvp_token,
    created_at: i.created_at,
    last_nudge_at: i.last_nudge_at,
  }))

  const nachfassFaellig = zaehleNachfassFaellige(eingeladen)

  const stand = zusagenMitBegleitung(eingeladen)
  const ziel = event.target_attendees ?? event.capacity

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/moments/events/${id}`} className="text-sm text-amber-400 hover:underline">
          ← {event.title}
        </Link>
        <h1 className="mt-1 text-xl font-bold">Einladen</h1>
        <p className="text-sm text-zinc-400">
          {stand.gesamt} kommen ({stand.zusagen} Zusagen + {stand.begleitungen} Begleitungen)
          {ziel ? ` · Ziel ${ziel}` : ""} — sortiert nach Passung, jede Einstufung erklärt sich
          über die Chips
        </p>
      </div>
      <InviteAssistant
        eventId={id}
        kandidaten={kandidaten}
        eingeladen={eingeladen}
        nachfassFaellig={nachfassFaellig}
      />
    </div>
  )
}
