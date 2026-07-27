import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui"

export const dynamic = "force-dynamic"

/**
 * Globale Suche über alle Module: Kontakte, Nachrichten, Gedächtnis,
 * Jobs, Events. Ein ilike pro Tabelle reicht bei Single-User-Datenmengen.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = (q ?? "").trim()
  // Zeichen raus, die die PostgREST-or()-Syntax brechen würden
  const safe = query.replace(/[,()%]/g, " ").trim()

  if (!safe || safe.length < 2) {
    return (
      <Card title="🔎 Suche">
        <p className="text-sm text-zinc-500">Mindestens 2 Zeichen eingeben — Suchfeld oben in der Leiste.</p>
      </Card>
    )
  }

  const supabase = await createClient()
  const like = `%${safe}%`
  const [contactsRes, messagesRes, memoriesRes, jobsRes, eventsRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, realm, platform, bio, notes, pipeline_stage")
      .or(`name.ilike.${like},bio.ilike.${like},notes.ilike.${like},location.ilike.${like}`)
      .limit(20),
    supabase
      .from("messages")
      .select("id, contact_id, direction, content, sent_at, contacts(name)")
      .ilike("content", like)
      .order("sent_at", { ascending: false })
      .limit(20),
    supabase
      .from("memories")
      .select("id, contact_id, kind, content, contacts(name)")
      .ilike("content", like)
      .limit(15),
    supabase
      .from("job_applications")
      .select("id, company, title, stage, city")
      .or(`company.ilike.${like},title.ilike.${like},notes.ilike.${like}`)
      .limit(20),
    supabase
      .from("events")
      .select("id, title, starts_at, location")
      .or(`title.ilike.${like},description.ilike.${like},location.ilike.${like}`)
      .limit(10),
  ])
  const artistsRes = await supabase
    .from("artists")
    .select("id, name, city, artist_type, notes")
    .or(`name.ilike.${like},city.ilike.${like},notes.ilike.${like}`)
    .limit(10)

  const contacts = contactsRes.data ?? []
  const messages = messagesRes.data ?? []
  const memories = memoriesRes.data ?? []
  const jobs = jobsRes.data ?? []
  const events = eventsRes.data ?? []
  const artists = artistsRes.data ?? []
  const total =
    contacts.length + messages.length + memories.length + jobs.length + events.length + artists.length

  /** Fundstelle mit etwas Kontext um den Treffer herum anzeigen. */
  function snippet(text: string | null): string {
    if (!text) return ""
    const i = text.toLowerCase().indexOf(safe.toLowerCase())
    if (i < 0) return text.slice(0, 90)
    const start = Math.max(0, i - 40)
    return `${start > 0 ? "…" : ""}${text.slice(start, i + safe.length + 50)}…`
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">
        🔎 „{query}&quot; <span className="text-sm font-normal text-zinc-500">({total} Treffer)</span>
      </h1>

      {contacts.length > 0 && (
        <Card title={`Kontakte (${contacts.length})`}>
          <ul className="space-y-1 text-sm">
            {contacts.map((c) => (
              <li key={c.id}>
                <Link href={`/contacts/${c.id}`} className="font-medium text-white hover:underline">
                  {c.name}
                </Link>{" "}
                <span className="text-xs text-zinc-500">
                  {c.realm === "moment" ? "MomentOS" : c.platform} · {c.pipeline_stage}
                </span>
                {(c.bio ?? c.notes) && <p className="text-xs text-zinc-400">{snippet(c.bio ?? c.notes)}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {messages.length > 0 && (
        <Card title={`Nachrichten (${messages.length})`}>
          <ul className="space-y-2 text-sm">
            {messages.map((m) => (
              <li key={m.id}>
                <Link href={`/contacts/${m.contact_id}`} className="font-medium text-white hover:underline">
                  {m.contacts?.name}
                </Link>{" "}
                <span className="text-xs text-zinc-500">
                  {m.direction === "out" ? "→ von mir" : "← an mich"}
                  {m.sent_at ? ` · ${new Date(m.sent_at).toLocaleDateString("de-DE")}` : ""}
                </span>
                <p className="text-xs text-zinc-400">{snippet(m.content)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {memories.length > 0 && (
        <Card title={`Gedächtnis (${memories.length})`}>
          <ul className="space-y-1 text-sm">
            {memories.map((m) => (
              <li key={m.id}>
                <Link href={`/contacts/${m.contact_id}`} className="font-medium text-white hover:underline">
                  {m.contacts?.name}
                </Link>{" "}
                <span className="text-xs text-zinc-500">[{m.kind}]</span>
                <p className="text-xs text-zinc-400">{snippet(m.content)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {jobs.length > 0 && (
        <Card title={`Jobs (${jobs.length})`}>
          <ul className="space-y-1 text-sm">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link href="/jobs" className="font-medium text-white hover:underline">
                  {j.title} · {j.company}
                </Link>{" "}
                <span className="text-xs text-zinc-500">{j.city} · {j.stage}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {events.length > 0 && (
        <Card title={`Events (${events.length})`}>
          <ul className="space-y-1 text-sm">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/moments/events/${e.id}`} className="font-medium text-white hover:underline">
                  {e.title}
                </Link>{" "}
                <span className="text-xs text-zinc-500">
                  {e.starts_at ? new Date(e.starts_at).toLocaleDateString("de-DE") : ""}
                  {e.location ? ` · ${e.location}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {artists.length > 0 && (
        <Card title={`Artists (${artists.length})`}>
          <ul className="space-y-1 text-sm">
            {artists.map((a) => (
              <li key={a.id}>
                <Link href={`/book/artists/${a.id}`} className="font-medium text-white hover:underline">
                  {a.name}
                </Link>{" "}
                <span className="text-xs text-zinc-500">
                  {a.artist_type}
                  {a.city ? ` · ${a.city}` : ""}
                </span>
                {a.notes && <p className="text-xs text-zinc-400">{snippet(a.notes)}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {total === 0 && (
        <Card>
          <p className="text-sm text-zinc-500">Nichts gefunden — anderer Begriff?</p>
        </Card>
      )}
    </div>
  )
}
