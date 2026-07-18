import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, StageBadge, ModuleChip, ModuleTile, EmptyState } from "@/components/ui"
import { Sparkline } from "@/components/charts"
import { FollowupDone } from "@/components/FollowupDone"
import { QuickReply } from "@/components/QuickReply"
import { ArchiveCandidates } from "@/components/ArchiveCandidates"
import type { Enums } from "@/lib/database.types"
import { daysUntilBirthday, connectionScore } from "@/lib/moments"
import { collectSignals } from "@/lib/signals"
import { dailyCounts } from "@/lib/charts"
import { MODULE_BY_ID } from "@/lib/modules"

export const dynamic = "force-dynamic"

const eur = (n: number) =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })

export default async function Dashboard() {
  const supabase = await createClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const day14 = new Date(now.getTime() - 14 * 86400_000).toISOString()
  const dayAgo = new Date(now.getTime() - 86400_000).toISOString()
  const today = nowIso.slice(0, 10)

  const [
    signals,
    contactsRes,
    momentContactsRes,
    msgsRes,
    datesRes,
    nextEventRes,
    scanRunsRes,
    gigsRes,
    jobsRunningRes,
    jobsNewTodayRes,
    briefingRes,
    equityRes,
    draftsRes,
  ] = await Promise.all([
    collectSignals(supabase),
    supabase
      .from("contacts")
      .select("id, name, pipeline_stage, priority, next_step, birthday, created_at")
      .eq("realm", "match")
      .neq("pipeline_stage", "archived"),
    supabase
      .from("contacts")
      .select("id, last_contact_at, contact_frequency_days")
      .eq("realm", "moment")
      .neq("pipeline_stage", "archived"),
    supabase
      .from("messages")
      .select("contact_id, sent_at, direction")
      .order("sent_at", { ascending: false }),
    supabase.from("dates").select("*, contacts(name)").gte("starts_at", nowIso).order("starts_at"),
    supabase
      .from("events")
      .select("id, title, starts_at, event_invites(status)")
      .gte("starts_at", nowIso)
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
    supabase.from("job_scan_runs").select("found, ran_at").gte("ran_at", day14).limit(500),
    supabase.from("gigs").select("id, status, fee_cents"),
    supabase
      .from("job_applications")
      .select("id", { count: "exact", head: true })
      .in("stage", ["applied", "answered", "interview"]),
    supabase
      .from("job_applications")
      .select("id", { count: "exact", head: true })
      .eq("stage", "discovered")
      .gte("created_at", dayAgo),
    supabase.from("settings").select("value").eq("key", "morning_briefing").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "trading_equity").maybeSingle(),
    supabase.from("suggestions").select("id", { count: "exact", head: true }).eq("status", "draft"),
  ])

  const contacts = contactsRes.data ?? []
  const warnings = signals.filter((s) => s.prio === 0)
  const feed = signals.filter((s) => s.prio > 0)

  // --- Kachel-Daten ---
  const msgs = msgsRes.data ?? []
  const repliesPerDay = dailyCounts(
    msgs.filter((m) => m.direction === "in").map((m) => m.sent_at),
    14,
    now
  )
  const overdueFriends = (momentContactsRes.data ?? []).filter((c) => connectionScore(c).overdue)
  const newMatches = contacts.filter((c) =>
    ["new_match", "first_message_pending"].includes(c.pipeline_stage)
  )
  const jobsFoundPerDay: number[] = (() => {
    // Scan-Läufe liefern Treffer-Summen pro Tag (nicht nur Anzahl der Läufe)
    const byDay = new Map<string, number>()
    for (const r of scanRunsRes.data ?? []) {
      const key = r.ran_at.slice(0, 10)
      byDay.set(key, (byDay.get(key) ?? 0) + r.found)
    }
    const out: number[] = []
    for (let i = 13; i >= 0; i--) {
      const key = new Date(now.getTime() - i * 86400_000).toISOString().slice(0, 10)
      out.push(byDay.get(key) ?? 0)
    }
    return out
  })()
  const gigs = gigsRes.data ?? []
  const activeGigs = gigs.filter((g) => !["cancelled", "played"].includes(g.status))
  const confirmedGigs = gigs.filter((g) => ["confirmed", "contracted"].includes(g.status))
  const confirmedFees = confirmedGigs.reduce((a, g) => a + (g.fee_cents ?? 0), 0) / 100

  let equity: { d: string; ki: number; bench: number }[] = []
  try {
    const parsed =
      typeof equityRes.data?.value === "string"
        ? JSON.parse(equityRes.data.value)
        : equityRes.data?.value
    if (Array.isArray(parsed)) equity = parsed
  } catch {
    /* keine Historie */
  }
  const lastEquity = equity[equity.length - 1]

  let briefing: { date: string; text: string } | null = null
  try {
    const parsed =
      typeof briefingRes.data?.value === "string"
        ? JSON.parse(briefingRes.data.value)
        : briefingRes.data?.value
    if (parsed && typeof parsed === "object" && "text" in parsed)
      briefing = parsed as { date: string; text: string }
  } catch {
    /* kein Briefing */
  }

  // --- Detail-Daten (unterer Bereich) ---
  const highPriority = contacts.filter((c) => c.priority === "high")
  const dateCandidates = contacts.filter((c) =>
    ["interest_visible", "date_idea", "on_messenger"].includes(c.pipeline_stage)
  )
  const birthdays = contacts
    .map((c) => ({ c, d: daysUntilBirthday(c.birthday) }))
    .filter((x) => x.d != null && x.d <= 14)
    .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
  const lastByContact = new Map<string, string>()
  for (const m of msgs) {
    if (!lastByContact.has(m.contact_id)) lastByContact.set(m.contact_id, m.sent_at)
  }
  const archiveWarn = contacts
    .map((c) => {
      const last = lastByContact.get(c.id) ?? c.created_at
      const days = Math.round((now.getTime() - new Date(last).getTime()) / 86400_000)
      return days >= 60 && days < 90 ? { id: c.id, name: c.name, days } : null
    })
    .filter((x): x is { id: string; name: string; days: number } => x !== null)
    .sort((a, b) => b.days - a.days)

  const nextEvent = nextEventRes.data
  const evInvites = nextEvent?.event_invites ?? []
  const evFunnel = {
    invited: evInvites.length,
    yes: evInvites.filter((i) => ["yes", "ticket", "attended"].includes(i.status)).length,
    ticket: evInvites.filter((i) => ["ticket", "attended"].includes(i.status)).length,
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
          {warnings.map((w) => (
            <p key={w.key}>
              ⚠️ <span className="font-medium">{w.title}</span>
              {w.detail && <span className="text-amber-200/70"> — {w.detail}</span>}
            </p>
          ))}
        </div>
      )}

      {/* Bento: fünf Modul-Kacheln mit Kennzahl + Trend */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <ModuleTile
          href="/contacts"
          module="match"
          value={String(contacts.length)}
          label="aktive Matches"
          sub={`${newMatches.length} neu · Antworten 14d:`}
        >
          <Sparkline values={repliesPerDay} color={MODULE_BY_ID.get("match")!.hex} title="Antworten pro Tag" />
        </ModuleTile>
        <ModuleTile
          href="/moments/people"
          module="moments"
          value={String(overdueFriends.length)}
          label="Freunde überfällig"
          sub={
            nextEvent
              ? `🎟 ${nextEvent.title}${
                  nextEvent.starts_at
                    ? ` · ${new Date(nextEvent.starts_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`
                    : ""
                }`
              : "kein Event geplant"
          }
        />
        <ModuleTile
          href="/jobs"
          module="jobs"
          value={String(jobsRunningRes.count ?? 0)}
          label="laufende Bewerbungen"
          sub={`${jobsNewTodayRes.count ?? 0} neue Funde 24h · Scan 14d:`}
        >
          <Sparkline values={jobsFoundPerDay} color={MODULE_BY_ID.get("jobs")!.hex} title="Job-Funde pro Tag" />
        </ModuleTile>
        <ModuleTile
          href="/book/artists"
          module="book"
          value={String(activeGigs.length)}
          label="Gigs in Pipeline"
          sub={`${confirmedGigs.length} bestätigt · ${eur(confirmedFees)} Gagen`}
        />
        <ModuleTile
          href="/trading"
          module="trading"
          value={lastEquity ? eur(lastEquity.ki) : "—"}
          label="KI-Depot (Paper)"
          sub={lastEquity ? `Benchmark ${eur(lastEquity.bench)}` : "Tageslauf ausstehend"}
        >
          {equity.length >= 2 && (
            <Sparkline
              values={equity.map((x) => x.ki)}
              color={MODULE_BY_ID.get("trading")!.hex}
              title="Depotwert-Verlauf"
            />
          )}
        </ModuleTile>
      </div>

      {/* Feed + Briefing */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={`☀️ Heute dran (${feed.length})`} className="lg:col-span-2">
          {feed.length === 0 ? (
            <EmptyState icon="🏝" text="Nichts offen — alle Module ruhig." />
          ) : (
            <ul className="space-y-2 text-sm">
              {feed.slice(0, 9).map((s) => (
                <li key={s.key} className="flex items-start gap-2">
                  <span className="mt-0.5">{s.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={s.href} className="font-medium text-white hover:underline">
                        {s.title}
                      </Link>
                      <ModuleChip module={s.module} />
                    </div>
                    {s.detail && <p className="text-zinc-400">{s.detail}</p>}
                    {s.contactId && s.module === "match" && <QuickReply contactId={s.contactId} />}
                  </div>
                  {s.followupId && <FollowupDone id={s.followupId} />}
                </li>
              ))}
            </ul>
          )}
          {feed.length > 9 && (
            <Link href="/inbox" className="mt-3 block text-sm text-rose-400 hover:underline">
              Alle {feed.length} in der Inbox →
            </Link>
          )}
        </Card>

        <Card title="🌅 Morgen-Briefing">
          {briefing?.date === today ? (
            <p className="whitespace-pre-wrap text-sm text-zinc-300">{briefing.text}</p>
          ) : briefing ? (
            <>
              <p className="text-xs text-zinc-500">
                Letztes Briefing vom{" "}
                {new Date(briefing.date).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" })}{" "}
                — heutiges kommt um 7:00
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">{briefing.text}</p>
            </>
          ) : (
            <EmptyState
              icon="🌅"
              text="Kommt täglich um 7:00 — per Telegram und hier: dein Tagesplan aus allen Modulen."
            />
          )}
        </Card>
      </div>

      {/* Detail-Karten */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

        {archiveWarn.length > 0 && (
          <Card title={`🪦 Bald im Auto-Archiv (${archiveWarn.length})`}>
            <ArchiveCandidates candidates={archiveWarn} />
          </Card>
        )}
      </div>

      {(draftsRes.count ?? 0) > 0 && (
        <Card title="Telegram-Entwürfe warten auf Freigabe">
          <Link href="/queue" className="text-sm text-rose-400 hover:underline">
            {draftsRes.count} Entwürfe in der Queue →
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
