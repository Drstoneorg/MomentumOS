import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, StageBadge } from "@/components/ui"
import { FollowupDone } from "@/components/FollowupDone"
import { QuickReply } from "@/components/QuickReply"
import { ArchiveCandidates } from "@/components/ArchiveCandidates"
import type { Enums } from "@/lib/database.types"
import { daysUntilBirthday } from "@/lib/moments"

export const dynamic = "force-dynamic"

const STALE_DAYS = 3
const GHOST_DAYS = 5

export default async function Dashboard() {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const [contactsRes, followupsRes, datesRes, draftsRes, heartbeatsRes, nextEventRes] = await Promise.all([
    supabase.from("contacts").select("*").eq("realm", "match").neq("pipeline_stage", "archived"),
    supabase
      .from("followups")
      .select("*, contacts(name, realm)")
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
    supabase.from("settings").select("key, value").like("key", "cron_heartbeat_%"),
    supabase
      .from("events")
      .select("id, title, starts_at, event_invites(status)")
      .gte("starts_at", now)
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
  ])

  // Ticket-Funnel fürs nächste Event
  const nextEvent = nextEventRes.data
  const evInvites = nextEvent?.event_invites ?? []
  const evFunnel = {
    invited: evInvites.length,
    yes: evInvites.filter((i) => i.status === "yes" || i.status === "ticket" || i.status === "attended").length,
    ticket: evInvites.filter((i) => i.status === "ticket" || i.status === "attended").length,
  }

  // JobOS für „Heute dran": Bewerbungen zum Nachfassen + frisch entdeckte Top-Matches
  const jobCutoff = new Date(Date.now() - 14 * 86400_000).toISOString()
  const daysAgo1 = new Date(Date.now() - 86400_000).toISOString()
  const [{ data: jobsToFollow }, { data: newTopJobs }] = await Promise.all([
    supabase
      .from("job_applications")
      .select("id, company, title, applied_at")
      .eq("stage", "applied")
      .lt("applied_at", jobCutoff),
    supabase
      .from("job_applications")
      .select("id, company, title, match_score")
      .eq("stage", "discovered")
      .gte("match_score", 65)
      .gte("created_at", daysAgo1),
  ])

  // Cron-Watchdog: warnen, wenn ein Cron nie oder seit >36h nicht gelaufen ist
  // (Vercel-Hobby-Limit kann Crons stillschweigend nicht ausführen).
  const CRONS = ["followups", "moments", "dispatch", "digest", "jobscan"]
  const beats = new Map(
    (heartbeatsRes.data ?? []).map((r) => [r.key.replace("cron_heartbeat_", ""), String(r.value)])
  )
  const cronProblems = CRONS.map((name) => {
    const last = beats.get(name)
    if (!last) return { name, info: "noch nie gelaufen" }
    const ageH = (Date.now() - new Date(last).getTime()) / 3600_000
    return ageH > 36 ? { name, info: `zuletzt vor ${Math.round(ageH)}h` } : null
  }).filter((x): x is { name: string; info: string } => x !== null)

  const contacts = contactsRes.data ?? []
  // MomentOS-Erinnerungen (Geburtstag/Kontaktpause bei Freunden) leben im MomentOS-Hub.
  const followups = (followupsRes.data ?? []).filter((f) => f.contacts?.realm !== "moment")
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
    .select("contact_id, sent_at, direction")
    .order("sent_at", { ascending: false })
  const lastByContact = new Map<string, { at: string; direction: string }>()
  for (const m of lastMsgs ?? []) {
    if (!lastByContact.has(m.contact_id))
      lastByContact.set(m.contact_id, { at: m.sent_at, direction: m.direction })
  }
  const staleCutoff = Date.now() - STALE_DAYS * 86400_000
  const activeStages = ["chatting", "interest_visible", "on_messenger"]
  // Eingeschlafen = SIE schrieb zuletzt, ich habe liegen lassen.
  const stale = contacts.filter((c) => {
    const last = lastByContact.get(c.id)
    return (
      last &&
      last.direction === "in" &&
      new Date(last.at).getTime() < staleCutoff &&
      activeStages.includes(c.pipeline_stage)
    )
  })
  // Ghosting-Radar = ICH schrieb zuletzt, seit GHOST_DAYS keine Antwort.
  const ghostCutoff = Date.now() - GHOST_DAYS * 86400_000
  const ghosted = contacts
    .map((c) => {
      const last = lastByContact.get(c.id)
      if (
        !last ||
        last.direction !== "out" ||
        new Date(last.at).getTime() >= ghostCutoff ||
        !activeStages.includes(c.pipeline_stage)
      )
        return null
      return { c, days: Math.round((Date.now() - new Date(last.at).getTime()) / 86400_000) }
    })
    .filter((x): x is { c: (typeof contacts)[number]; days: number } => x !== null)
    .sort((a, b) => b.days - a.days)
  // Auto-Archiv-Vorwarnung: 60-90 Tage gar keine Aktivität (Cron archiviert ab 90)
  const archiveWarn = contacts
    .map((c) => {
      const last = lastByContact.get(c.id)?.at ?? c.created_at
      const days = Math.round((Date.now() - new Date(last).getTime()) / 86400_000)
      return days >= 60 && days < 90 ? { id: c.id, name: c.name, days } : null
    })
    .filter((x): x is { id: string; name: string; days: number } => x !== null)
    .sort((a, b) => b.days - a.days)

  // „Heute dran": eine Abarbeitungsliste statt Suchen in Einzel-Boxen.
  const todayBirthdays = birthdays.filter((b) => b.d === 0)
  const todayCount =
    followups.length +
    stale.length +
    todayBirthdays.length +
    (jobsToFollow?.length ?? 0) +
    (newTopJobs?.length ?? 0)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>

      {cronProblems.length > 0 && (
        <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
          ⚠️ Cron-Jobs laufen nicht: {cronProblems.map((c) => `${c.name} (${c.info})`).join(", ")}.
          Vercel-Hobby erlaubt nur begrenzt Crons — fehlende bei cron-job.com anlegen:
          URL <code className="text-amber-100">/api/cron/&lt;name&gt;</code>, Header{" "}
          <code className="text-amber-100">Authorization: Bearer &lt;CRON_SECRET&gt;</code>.
        </div>
      )}

      {todayCount > 0 && (
        <Card title={`☀️ Heute dran (${todayCount})`}>
          <ul className="space-y-2 text-sm">
            {todayBirthdays.map(({ c }) => (
              <li key={`b-${c.id}`} className="flex items-center gap-2">
                <span>🎂</span>
                <Link href={`/contacts/${c.id}`} className="font-medium text-white hover:underline">{c.name}</Link>
                <span className="text-zinc-400">hat heute Geburtstag — Gruß in der <Link href="/queue" className="text-rose-400 hover:underline">Queue</Link> prüfen</span>
              </li>
            ))}
            {followups.map((f) => (
              <li key={`f-${f.id}`} className="flex items-center gap-2">
                <span>⏰</span>
                <Link href={`/contacts/${f.contact_id}`} className="font-medium text-white hover:underline">{f.contacts?.name}</Link>
                <span className="text-zinc-400">{f.reason ?? "Nachfassen"}</span>
              </li>
            ))}
            {stale.map((c) => (
              <li key={`s-${c.id}`} className="flex items-center gap-2">
                <span>💤</span>
                <Link href={`/contacts/${c.id}`} className="font-medium text-white hover:underline">{c.name}</Link>
                <span className="text-zinc-400">eingeschlafen — wieder anknüpfen</span>
              </li>
            ))}
            {(newTopJobs ?? []).map((j) => (
              <li key={`nj-${j.id}`} className="flex items-center gap-2">
                <span>💼</span>
                <Link href="/jobs" className="font-medium text-white hover:underline">{j.title} · {j.company}</Link>
                <span className="text-emerald-400">{j.match_score}% Match — neu gefunden, bewerben?</span>
              </li>
            ))}
            {(jobsToFollow ?? []).map((j) => (
              <li key={`jf-${j.id}`} className="flex items-center gap-2">
                <span>💼</span>
                <Link href="/jobs" className="font-medium text-white hover:underline">{j.company}</Link>
                <span className="text-zinc-400">
                  Bewerbung seit {Math.round((Date.now() - new Date(j.applied_at!).getTime()) / 86400_000)}d ohne Antwort — nachfassen
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title={`Fällige Follow-ups (${followups.length})`}>
          <ul className="space-y-2 text-sm">
            {followups.map((f) => (
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
            {!followups.length && <li className="text-zinc-500">Nichts fällig. 👌</li>}
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

        <Card title={`👻 Ghosting-Radar (${ghosted.length})`}>
          <ul className="space-y-2 text-sm">
            {ghosted.map(({ c, days }) => (
              <li key={c.id}>
                <Link href={`/contacts/${c.id}`} className="font-medium text-white hover:underline">
                  {c.name}
                </Link>{" "}
                <span className="text-amber-400">{days}d keine Antwort</span>
                <p className="text-xs text-zinc-500">Reaktivierungs-Entwurf kommt automatisch in die Queue</p>
                <QuickReply contactId={c.id} />
              </li>
            ))}
            {!ghosted.length && (
              <li className="text-zinc-500">Niemand ghostet dich gerade. 👌</li>
            )}
          </ul>
        </Card>

        <Card title={`Date-Kandidaten (${dateCandidates.length})`}>
          <ContactList contacts={dateCandidates} empty="Noch niemand reif für einen Vorschlag." />
        </Card>

        <Card title={`Hohe Priorität (${highPriority.length})`}>
          <ContactList contacts={highPriority} empty="Keine Kontakte mit hoher Priorität." />
        </Card>

        {nextEvent && (
          <Card title="🎟 Nächstes Event">
            <Link href={`/moments/events/${nextEvent.id}`} className="text-sm font-medium text-white hover:underline">
              {nextEvent.title}
            </Link>
            <p className="mt-1 text-xs text-zinc-400">
              {nextEvent.starts_at
                ? new Date(nextEvent.starts_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })
                : "Datum offen"}
            </p>
            <p className="mt-2 text-xs text-zinc-400">
              Funnel: <span className="text-zinc-200">{evFunnel.invited}</span> eingeladen
              {" → "}<span className="text-emerald-300">{evFunnel.yes}</span> zugesagt
              {" → "}<span className="text-violet-300">{evFunnel.ticket}</span> Ticket
            </p>
          </Card>
        )}

        {archiveWarn.length > 0 && (
          <Card title={`🪦 Bald im Auto-Archiv (${archiveWarn.length})`}>
            <ArchiveCandidates candidates={archiveWarn} />
          </Card>
        )}

        <Card title={`Geburtstage (${birthdays.length})`}>
          <ul className="space-y-2 text-sm">
            {birthdays.map(({ c, d }) => (
              <li key={c.id}>
                <Link href={`/contacts/${c.id}`} className="font-medium text-white hover:underline">{c.name}</Link>{" "}
                <span className={d === 0 ? "text-rose-400" : "text-zinc-400"}>{d === 0 ? "heute 🎂" : `in ${d}d`}</span>
              </li>
            ))}
            {!birthdays.length && <li className="text-zinc-500">Keine in 14 Tagen. <Link href="/moments" className="text-rose-400 hover:underline">MomentOS →</Link></li>}
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
