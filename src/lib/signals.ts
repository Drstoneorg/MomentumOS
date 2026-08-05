import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import type { SignalModule } from "@/lib/modules"
import { daysUntilBirthday, connectionScore } from "@/lib/moments"
import { gigStaleDays, GIG_STATUS_LABELS } from "@/lib/artists"
import { scanWarnings } from "@/lib/jobScanHealth"
import { CRON_NAMES, CRON_MAX_AGE_HOURS } from "@/lib/cronHeartbeat"

/**
 * Kommando-Zentrale: EIN Sammler für alle Handlungs-Signale der Plattform.
 * Dashboard-Feed, /inbox und Morgen-Briefing lesen dieselbe Liste — was hier
 * nicht auftaucht, kann nirgendwo versanden.
 */
export type Signal = {
  key: string
  module: SignalModule
  icon: string
  title: string
  detail?: string
  href: string
  /** 0 = Warnung (System kaputt), 1 = heute dran, 2 = demnächst */
  prio: 0 | 1 | 2
  /** Für Inline-Aktionen im Feed */
  contactId?: string
  followupId?: string
  gigId?: string
  jobId?: string
  jobEmail?: string | null
  jobHasLetter?: boolean
  dateId?: string
  /** Check-in-Entwurf anbieten (MomentOS-Rhythmus/Geburtstag) */
  checkin?: boolean
}

export const PRIO_LABELS: Record<0 | 1 | 2, string> = {
  0: "⚠️ Warnungen",
  1: "☀️ Heute dran",
  2: "🔭 Demnächst",
}

const MODULE_ORDER: SignalModule[] = ["system", "match", "moments", "jobs", "book", "recruit", "trading"]

export function sortSignals(list: Signal[]): Signal[] {
  return [...list].sort(
    (a, b) =>
      a.prio - b.prio ||
      MODULE_ORDER.indexOf(a.module) - MODULE_ORDER.indexOf(b.module) ||
      a.title.localeCompare(b.title, "de")
  )
}

/** Cron-Watchdog als pure Funktion (Trading läuft nur werktags → längeres Fenster). */
export function cronProblems(
  beats: Map<string, string>,
  now = Date.now()
): { name: string; info: string }[] {
  const out: { name: string; info: string }[] = []
  for (const name of CRON_NAMES) {
    const maxH = name === "trading" ? 100 : CRON_MAX_AGE_HOURS
    const last = beats.get(name)
    if (!last) {
      out.push({ name, info: "noch nie gelaufen" })
      continue
    }
    const ageH = (now - new Date(last).getTime()) / 3600_000
    if (ageH > maxH) out.push({ name, info: `zuletzt vor ${Math.round(ageH)}h` })
  }
  return out
}

const STALE_DAYS = 3
const GHOST_DAYS = 5
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export async function collectSignals(supabase: SupabaseClient<Database>): Promise<Signal[]> {
  const now = new Date()
  const nowIso = now.toISOString()
  const in7d = new Date(now.getTime() + 7 * 86400_000).toISOString()
  const jobCutoff = new Date(now.getTime() - 14 * 86400_000).toISOString()
  const dayAgo = new Date(now.getTime() - 86400_000).toISOString()

  const [
    matchContactsRes,
    momentContactsRes,
    followupsRes,
    lastMsgsRes,
    draftsRes,
    heartbeatsRes,
    scanRunsRes,
    gigsRes,
    jobsFollowRes,
    jobsNewRes,
    jobsInterviewRes,
    datesRes,
    eventsRes,
    snoozesRes,
    recruitAppsRes,
    errorsRes,
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, pipeline_stage, birthday")
      .eq("realm", "match")
      .neq("pipeline_stage", "archived"),
    supabase
      .from("contacts")
      .select("id, name, birthday, last_contact_at, contact_frequency_days")
      .eq("realm", "moment")
      .neq("pipeline_stage", "archived"),
    supabase
      .from("followups")
      .select("id, contact_id, reason, contacts(name, realm)")
      .eq("done", false)
      .lte("due_at", nowIso)
      .order("due_at")
      .limit(15),
    supabase.from("messages").select("contact_id, sent_at, direction").order("sent_at", { ascending: false }),
    supabase.from("suggestions").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("settings").select("key, value").like("key", "cron_heartbeat_%"),
    supabase.from("job_scan_runs").select("portal, found, ran_at").order("ran_at", { ascending: false }).limit(40),
    supabase
      .from("gigs")
      .select("id, artist_id, status, status_changed_at, artists(name)")
      .in("status", ["inquired", "negotiating"]),
    supabase
      .from("job_applications")
      .select("id, company, title, applied_at")
      .eq("stage", "applied")
      .lt("applied_at", jobCutoff)
      .limit(10),
    supabase
      .from("job_applications")
      .select("id, company, title, match_score, contact_email, cover_letter")
      .eq("stage", "discovered")
      .gte("match_score", 65)
      .gte("created_at", dayAgo)
      .limit(10),
    supabase
      .from("job_applications")
      .select("id, company, title, interview_at")
      .not("interview_at", "is", null)
      .gte("interview_at", nowIso)
      .lte("interview_at", in7d)
      .order("interview_at")
      .limit(5),
    supabase
      .from("dates")
      .select("id, contact_id, starts_at, place, contacts(name)")
      .gte("starts_at", nowIso)
      .lte("starts_at", in7d)
      .order("starts_at")
      .limit(5),
    supabase
      .from("events")
      .select("id, title, starts_at")
      .gte("starts_at", nowIso)
      .lte("starts_at", in7d)
      .order("starts_at")
      .limit(3),
    supabase.from("signal_snoozes").select("key, until").gte("until", nowIso),
    supabase
      .from("recruit_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("client_errors")
      .select("message, created_at")
      .gte("created_at", dayAgo)
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  const signals: Signal[] = []

  // --- System-Warnungen (prio 0) ---
  const beats = new Map(
    (heartbeatsRes.data ?? []).map((r) => [r.key.replace("cron_heartbeat_", ""), String(r.value)])
  )
  for (const p of cronProblems(beats, now.getTime())) {
    signals.push({
      key: `cron-${p.name}`,
      module: "system",
      icon: "⚙️",
      title: `Cron „${p.name}" läuft nicht`,
      detail: `${p.info} — bei cron-job.org anlegen: /api/cron/${p.name} mit Bearer CRON_SECRET`,
      href: "/",
      prio: 0,
    })
  }
  // Frische Laufzeitfehler aus der Fehler-Telemetrie (letzte 24h)
  const fehler = errorsRes.data ?? []
  if (fehler.length > 0) {
    signals.push({
      key: "client-errors",
      module: "system",
      icon: "🐞",
      title: `${fehler.length}× Laufzeitfehler in 24h`,
      detail: `zuletzt: ${fehler[0].message.slice(0, 90)}`,
      href: "/",
      prio: 0,
    })
  }

  // Jobscan-Totalausfall: Cron piepst, aber es gab noch NIE einen Scan-Lauf
  // (fehlende Suchbegriffe/CV) — scanWarnings greift erst ab 3 Läufen.
  if (!(scanRunsRes.data ?? []).length && beats.has("jobscan")) {
    signals.push({
      key: "jobscan-nie",
      module: "system",
      icon: "🕸",
      title: "Auto-Jobscan hat noch nie gescannt",
      detail:
        "Cron läuft, aber ohne Suchbegriffe kein Scan — er leitet sie beim nächsten Lauf aus dem CV ab; auf /jobs prüfbar",
      href: "/jobs",
      prio: 0,
    })
  }
  for (const w of scanWarnings(scanRunsRes.data ?? [])) {
    signals.push({
      key: `portal-${w.portal}`,
      module: "system",
      icon: "🕸",
      title: `Job-Portal „${w.portal}" liefert nichts mehr`,
      detail: `${w.zeroRuns} Läufe in Folge ohne Treffer — Scraper vermutlich kaputt`,
      href: "/jobs",
      prio: 0,
    })
  }

  // --- MatchOS ---
  const matchContacts = matchContactsRes.data ?? []
  const lastByContact = new Map<string, { at: string; direction: string }>()
  for (const m of lastMsgsRes.data ?? []) {
    if (!lastByContact.has(m.contact_id))
      lastByContact.set(m.contact_id, { at: m.sent_at, direction: m.direction })
  }
  for (const f of followupsRes.data ?? []) {
    if (f.contacts?.realm === "moment") continue
    signals.push({
      key: `fu-${f.id}`,
      module: "match",
      icon: "⏰",
      title: `${f.contacts?.name ?? "Kontakt"}: nachfassen`,
      detail: f.reason ?? undefined,
      href: `/contacts/${f.contact_id}`,
      prio: 1,
      contactId: f.contact_id,
      followupId: f.id,
    })
  }
  const activeStages = ["chatting", "interest_visible", "on_messenger"]
  const staleCutoff = now.getTime() - STALE_DAYS * 86400_000
  const ghostCutoff = now.getTime() - GHOST_DAYS * 86400_000
  for (const c of matchContacts) {
    if (!activeStages.includes(c.pipeline_stage)) continue
    const last = lastByContact.get(c.id)
    if (!last) continue
    const t = new Date(last.at).getTime()
    if (last.direction === "in" && t < staleCutoff) {
      signals.push({
        key: `stale-${c.id}`,
        module: "match",
        icon: "💤",
        title: `${c.name} wartet auf Antwort`,
        detail: `ihre Nachricht liegt seit ${Math.floor((now.getTime() - t) / 86400_000)} Tagen unbeantwortet`,
        href: `/contacts/${c.id}`,
        prio: 1,
        contactId: c.id,
      })
    } else if (last.direction === "out" && t < ghostCutoff) {
      signals.push({
        key: `ghost-${c.id}`,
        module: "match",
        icon: "👻",
        title: `${c.name}: ${Math.floor((now.getTime() - t) / 86400_000)}d keine Antwort`,
        detail: "Reaktivierungs-Entwurf liegt automatisch in der Queue",
        href: `/contacts/${c.id}`,
        prio: 2,
        contactId: c.id,
      })
    }
  }
  for (const c of matchContacts) {
    const d = daysUntilBirthday(c.birthday, now)
    if (d === 0) {
      signals.push({
        key: `bday-m-${c.id}`,
        module: "match",
        icon: "🎂",
        title: `${c.name} hat heute Geburtstag`,
        detail: "Gruß in der Queue prüfen",
        href: `/contacts/${c.id}`,
        prio: 1,
        contactId: c.id,
      })
    }
  }
  const draftCount = draftsRes.count ?? 0
  if (draftCount > 0) {
    signals.push({
      key: "queue-drafts",
      module: "match",
      icon: "📨",
      title: `${draftCount} ${plural(draftCount, "Entwurf wartet", "Entwürfe warten")} auf Freigabe`,
      href: "/queue",
      prio: 1,
    })
  }
  for (const d of datesRes.data ?? []) {
    const inDays = Math.floor((new Date(d.starts_at).getTime() - now.getTime()) / 86400_000)
    signals.push({
      dateId: d.id,
      key: `date-${d.id}`,
      module: "match",
      icon: "💘",
      title: `Date mit ${d.contacts?.name ?? "?"} ${inDays === 0 ? "heute" : `in ${inDays}d`}`,
      detail: [
        new Date(d.starts_at).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" }),
        d.place ?? undefined,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/contacts/${d.contact_id}`,
      prio: inDays <= 1 ? 1 : 2,
    })
  }

  // --- MomentOS ---
  const momentContacts = momentContactsRes.data ?? []
  for (const c of momentContacts) {
    const d = daysUntilBirthday(c.birthday, now)
    if (d != null && d <= 7) {
      signals.push({
        key: `bday-f-${c.id}`,
        module: "moments",
        icon: "🎂",
        title: d === 0 ? `${c.name} hat heute Geburtstag` : `${c.name}: Geburtstag in ${d}d`,
        detail: d === 0 ? "Karte/Gruß rausschicken" : "Karte vorbereiten?",
        href: `/contacts/${c.id}`,
        prio: d === 0 ? 1 : 2,
        contactId: c.id,
        checkin: true,
      })
    }
  }
  const overdueFriends = momentContacts
    .map((c) => ({ c, s: connectionScore(c) }))
    .filter((x) => x.s.overdue)
    .sort((a, b) => b.s.score - a.s.score)
    .slice(0, 5)
  for (const { c, s } of overdueFriends) {
    signals.push({
      key: `rhythm-${c.id}`,
      module: "moments",
      icon: "🤝",
      title: `${c.name} lange nicht gehört`,
      detail: s.daysSince != null ? `${s.daysSince} Tage seit letztem Kontakt` : "noch nie Kontakt vermerkt",
      href: `/contacts/${c.id}`,
      prio: 2,
      contactId: c.id,
      checkin: true,
    })
  }
  for (const e of eventsRes.data ?? []) {
    const inDays = e.starts_at
      ? Math.floor((new Date(e.starts_at).getTime() - now.getTime()) / 86400_000)
      : null
    signals.push({
      key: `event-${e.id}`,
      module: "moments",
      icon: "🎟",
      title: `Event „${e.title}" ${inDays === 0 ? "heute" : `in ${inDays}d`}`,
      detail: "Gästeliste, Lineup und Budget checken",
      href: `/moments/events/${e.id}`,
      prio: inDays != null && inDays <= 1 ? 1 : 2,
    })
  }

  // --- JobOS ---
  for (const j of jobsNewRes.data ?? []) {
    signals.push({
      key: `job-new-${j.id}`,
      module: "jobs",
      icon: "✨",
      title: `${j.title} · ${j.company}`,
      detail: `${j.match_score}% Match — neu gefunden, bewerben?`,
      href: "/jobs",
      prio: 1,
      jobId: j.id,
      jobEmail: j.contact_email,
      jobHasLetter: !!j.cover_letter?.trim(),
    })
  }
  for (const j of jobsInterviewRes.data ?? []) {
    if (!j.interview_at) continue
    const inDays = Math.floor((new Date(j.interview_at).getTime() - now.getTime()) / 86400_000)
    signals.push({
      key: `job-iv-${j.id}`,
      module: "jobs",
      icon: "🎤",
      title: `Interview ${j.company} ${inDays === 0 ? "heute" : `in ${inDays}d`}`,
      detail: new Date(j.interview_at).toLocaleString("de-DE", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      href: "/jobs",
      prio: inDays <= 1 ? 1 : 2,
    })
  }
  for (const j of jobsFollowRes.data ?? []) {
    const days = j.applied_at
      ? Math.round((now.getTime() - new Date(j.applied_at).getTime()) / 86400_000)
      : null
    signals.push({
      key: `job-fu-${j.id}`,
      module: "jobs",
      icon: "📮",
      title: `${j.company}: Bewerbung nachfassen`,
      detail: days != null ? `seit ${days} Tagen ohne Antwort` : undefined,
      href: "/jobs",
      prio: 1,
    })
  }

  // --- RecruitOS ---
  const newApps = recruitAppsRes.count ?? 0
  if (newApps > 0) {
    signals.push({
      key: "recruit-apps",
      module: "recruit",
      icon: "📸",
      title: `${newApps} ${plural(newApps, "neue Model-Bewerbung", "neue Model-Bewerbungen")}`,
      detail: "über die Landing-Page eingegangen — sichten und übernehmen",
      href: "/recruit/bewerbungen",
      prio: 1,
    })
  }

  // --- BookOS ---
  for (const g of gigsRes.data ?? []) {
    const staleDays = gigStaleDays(g.status, g.status_changed_at, now)
    if (staleDays == null) continue
    signals.push({
      gigId: g.id,
      key: `gig-${g.id}`,
      module: "book",
      icon: "🎧",
      title: `${g.artists?.name ?? "Artist"}: seit ${staleDays}d ${GIG_STATUS_LABELS[g.status] ?? g.status}`,
      detail: "Erinnerung entwerfen und rausschicken",
      href: `/book/artists/${g.artist_id}`,
      prio: 1,
    })
  }

  // Gesnoozte Signale ausblenden (bis-Datum liegt in der Zukunft)
  const snoozed = new Set((snoozesRes.data ?? []).map((s) => s.key))
  return sortSignals(signals.filter((s) => !snoozed.has(s.key)))
}
