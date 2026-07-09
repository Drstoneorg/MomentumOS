import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, StageBadge } from "@/components/ui"
import { FollowupDone } from "@/components/FollowupDone"
import { QuickReply } from "@/components/QuickReply"
import type { Enums } from "@/lib/database.types"
import { daysUntilBirthday } from "@/lib/moments"

export const dynamic = "force-dynamic"

const STALE_DAYS = 3

export default async function Dashboard() {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const [contactsRes, followupsRes, datesRes, draftsRes] = await Promise.all([
    supabase.from("contacts").select("*").neq("pipeline_stage", "archived"),
    supabase
      .from("followups")
      .select("*, contacts(name)")
      .eq("done", false)
      .lte("due_at", now)
      .order("due_at"),
    supabase
      .from("dates")
      .select("*, contacts(name)")
      .gte("starts_at", now)
      .order("starts_at"),
    supabase
      .from("suggestions")
      .select("id")
      .eq("status", "draft")
      .eq("channel", "telegram"),
  ])

  const contacts = contactsRes.data ?? []
  const newMatches = contacts.filter((c) =>
    ["new_match", "first_message_pending"].includes(c.pipeline_stage)
  )
  const highPriority = contacts.filter((c) => c.priority === "high")
  const birthdays = contacts
    .map((c) => ({ c, d: daysUntilBirthday(c.birthday) }))
    .filter((x) => x.d != null && x.d <= 14)
    .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
  const dateCandidates = contacts.filter((c) =>
    ["interest_visible", "date_idea", "on_messenger"].includes(c.pipeline_stage)
  )

  // Eingeschlafen: letzte Nachricht älter als STALE_DAYS
  const { data: lastMsgs } = await supabase
    .from("messages")
    .select("contact_id, sent_at")
    .order("sent_at", { ascending: false })
  const lastByContact = new Map<string, string>()
  for (const m of lastMsgs ?? []) {
    if (!lastByContact.has(m.contact_id)) lastByContact.set(m.contact_id, m.sent_at)
  }
  const staleCutoff = Date.now() - STALE_DAYS * 86400_000
  const stale = contacts.filter((c) => {
    const last = lastByContact.get(c.id)
    return (
      last &&
      new Date(last).getTime() < staleCutoff &&
      ["chatting", "interest_visible", "on_messenger"].includes(c.pipeline_stage)
    )
  })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title={`Fällige Follow-ups (${followupsRes.data?.length ?? 0})`}>
          <ul className="space-y-2 text-sm">
            {(followupsRes.data ?? []).map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <Link href={`/contacts/${f.contact_id}`} className="font-medium text-white hover:underline">
                    {f.contacts?.name}
                  </Link>
                  <p className="text-zinc-400">{f.reason ?? "Nachfassen"}</p>
                  <QuickReply contactId={f.contact_id} />
                </div>
                <FollowupDone id={f.id} />
              </li>
            ))}
            {!followupsRes.data?.length && <li className="text-zinc-500">Nichts fällig. 👌</li>}
          </ul>
        </Card>

        <Card title={`Neue Matches (${newMatches.length})`}>
          <ContactList contacts={newMatches} empty="Keine neuen Matches." />
        </Card>

        <Card title={`Geplante Dates (${datesRes.data?.length ?? 0})`}>
          <ul className="space-y-2 text-sm">
            {(datesRes.data ?? []).map((d) => (
              <li key={d.id}>
                <Link href={`/contacts/${d.contact_id}`} className="font-medium text-white hover:underline">
                  {d.contacts?.name}
                </Link>
                <p className="text-zinc-400">
                  {new Date(d.starts_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
                  {d.place ? ` · ${d.place}` : ""}
                </p>
                <a href={`/api/dates/${d.id}/ics`} className="text-xs text-rose-400 hover:underline">
                  📅 .ics
                </a>
              </li>
            ))}
            {!datesRes.data?.length && <li className="text-zinc-500">Keine Dates geplant — Zeit, das zu ändern.</li>}
          </ul>
        </Card>

        <Card title={`Eingeschlafen (${stale.length})`}>
          <ContactList contacts={stale} empty={`Kein Gespräch älter als ${STALE_DAYS} Tage.`} />
        </Card>

        <Card title={`Date-Kandidaten (${dateCandidates.length})`}>
          <ContactList contacts={dateCandidates} empty="Noch niemand reif für einen Vorschlag." />
        </Card>

        <Card title={`Hohe Priorität (${highPriority.length})`}>
          <ContactList contacts={highPriority} empty="Keine Kontakte mit hoher Priorität." />
        </Card>

        <Card title={`Geburtstage (${birthdays.length})`}>
          <ul className="space-y-2 text-sm">
            {birthdays.map(({ c, d }) => (
              <li key={c.id}>
                <Link href={`/contacts/${c.id}`} className="font-medium text-white hover:underline">{c.name}</Link>{" "}
                <span className={d === 0 ? "text-rose-400" : "text-zinc-400"}>{d === 0 ? "heute 🎂" : `in ${d}d`}</span>
              </li>
            ))}
            {!birthdays.length && <li className="text-zinc-500">Keine in 14 Tagen. <Link href="/moments" className="text-rose-400 hover:underline">Moments →</Link></li>}
          </ul>
        </Card>
      </div>

      {(draftsRes.data?.length ?? 0) > 0 && (
        <Card title="Telegram-Entwürfe warten auf Freigabe">
          <Link href="/queue" className="text-sm text-rose-400 hover:underline">
            {draftsRes.data!.length} Entwürfe in der Queue →
          </Link>
        </Card>
      )}
    </div>
  )
}

function ContactList({
  contacts,
  empty,
}: {
  contacts: {
    id: string
    name: string
    pipeline_stage: Enums<"pipeline_stage">
    next_step: string | null
  }[]
  empty: string
}) {
  return (
    <ul className="space-y-2 text-sm">
      {contacts.map((c) => (
        <li key={c.id}>
          <Link href={`/contacts/${c.id}`} className="font-medium text-white hover:underline">
            {c.name}
          </Link>{" "}
          <StageBadge stage={c.pipeline_stage} />
          {c.next_step && <p className="text-zinc-400">{c.next_step}</p>}
          <QuickReply contactId={c.id} />
        </li>
      ))}
      {!contacts.length && <li className="text-zinc-500">{empty}</li>}
    </ul>
  )
}
