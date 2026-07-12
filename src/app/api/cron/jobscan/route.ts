import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { chatJSON } from "@/lib/ai/deepseek"
import { extractJob, scoreJob, generateCoverLetter, type CvProfile } from "@/lib/ai/jobs"
import { sendPushToAll } from "@/lib/push"
import { beatCron } from "@/lib/cronHeartbeat"
import { normalizeJobUrl, jobKey } from "@/lib/jobDedupe"

export const maxDuration = 60

// Portale, deren Suchseiten serverseitig abrufbar sind (SSR-HTML, kein Bot-Block).
// LinkedIn/StepStone/Indeed blocken Server-Anfragen — die laufen über die Extension.
const SCRAPE_PORTALS: { portal: string; city: string; url: (q: string) => string }[] = [
  { portal: "karriere_at", city: "wien", url: (q) => `https://www.karriere.at/jobs/${encodeURIComponent(q)}/wien` },
  { portal: "mediajobs", city: "wien", url: (q) => `https://www.mediajobs.at/jobs?what=${encodeURIComponent(q)}` },
  { portal: "jobs_at", city: "wien", url: (q) => `https://www.jobs.at/j/${encodeURIComponent(q)}/wien` },
  { portal: "berlinstartupjobs", city: "berlin", url: (q) => `https://berlinstartupjobs.com/?s=${encodeURIComponent(q)}` },
]

const MAX_DETAIL_FETCHES = 4 // KI-Extraktion + Score pro Lauf begrenzen (Zeit + Kosten)
const AUTO_LETTER_SCORE = 65
const FOLLOWUP_AFTER_DAYS = 14
const MAX_FOLLOWUP_DRAFTS = 3

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
}

// Anker (Text + Link) aus Such-HTML ziehen — Grundlage für die KI-Trefferauswahl.
function extractAnchors(html: string, baseUrl: string): { text: string; href: string }[] {
  const out: { text: string; href: string }[] = []
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < 200) {
    const text = stripHtml(m[2]).trim()
    if (text.length < 8 || text.length > 160) continue
    try {
      out.push({ text, href: new URL(m[1], baseUrl).href })
    } catch {
      /* kaputte URL überspringen */
    }
  }
  return out
}

/**
 * Täglicher Auto-Jobscan: durchsucht scrape-taugliche Portale mit den gespeicherten
 * Suchbegriffen (settings job_auto_search), erfasst neue Treffer inkl. Match-Score
 * (+ Auto-Anschreiben bei gutem Match) und entwirft Nachfass-Mails für Bewerbungen
 * ohne Antwort. Bewerben/Senden bleibt beim Nutzer.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  await beatCron(supabase, "jobscan")

  const [{ data: cfgRow }, { data: cvRow }, { data: existing }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "job_auto_search").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "job_cv_profile").maybeSingle(),
    supabase.from("job_applications").select("company, title, url"),
  ])

  let terms: string[] = []
  try {
    const parsed = typeof cfgRow?.value === "string" ? JSON.parse(cfgRow.value) : cfgRow?.value
    terms = Array.isArray(parsed?.terms) ? parsed.terms.filter(Boolean).slice(0, 3) : []
  } catch {
    /* keine/kaputte Config */
  }
  if (!terms.length) {
    return NextResponse.json({ skipped: "keine Suchbegriffe — auf /jobs unter Auto-Suche speichern" })
  }
  const cv = (cvRow?.value as CvProfile | null) ?? null

  const knownUrls = new Set(
    (existing ?? []).map((j) => normalizeJobUrl(j.url)).filter(Boolean)
  )
  const knownKeys = new Set((existing ?? []).map((j) => jobKey(j.company, j.title)))

  // 1) Suchseiten abrufen, KI wählt echte Stellen-Treffer aus den Links.
  const candidates: { title: string; url: string; portal: string; city: string }[] = []
  for (const p of SCRAPE_PORTALS) {
    for (const term of terms) {
      try {
        const res = await fetch(p.url(term), {
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh) MatchOS-JobScan" },
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) continue
        const anchors = extractAnchors(await res.text(), p.url(term))
        if (!anchors.length) continue
        const list = anchors.map((a, i) => `${i}: ${a.text}`).join("\n").slice(0, 6000)
        const out = await chatJSON(
          `Du bekommst Linktexte einer Jobportal-Suchseite. Wähle die, die echte Stellenanzeigen-Treffer zum Suchbegriff "${term}" sind (keine Navigation, keine Kategorien, keine Werbung).
Antworte NUR als JSON: {"hits":[Indexzahlen]} — maximal 5.`,
          list,
          "job_scan"
        )
        const hits = (JSON.parse(out) as { hits?: number[] }).hits ?? []
        for (const i of hits.slice(0, 5)) {
          const a = anchors[i]
          if (a) candidates.push({ title: a.text, url: a.href, portal: p.portal, city: p.city })
        }
      } catch {
        // Portal nicht erreichbar/blockt — nächstes
      }
    }
  }

  // 2) Neue Kandidaten: Detailseite holen, extrahieren, scoren, speichern.
  let created = 0
  const createdList: string[] = []
  for (const c of candidates) {
    if (created >= MAX_DETAIL_FETCHES) break
    if (knownUrls.has(normalizeJobUrl(c.url))) continue
    try {
      const res = await fetch(c.url, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh) MatchOS-JobScan" },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const raw = stripHtml(await res.text()).slice(0, 10000)
      if (raw.length < 200) continue
      const job = await extractJob(raw, c.url)
      const key = jobKey(job.company, job.title)
      if (knownKeys.has(key)) continue
      knownKeys.add(key)
      const score = cv ? await scoreJob(cv, job) : null

      let coverLetter: string | null = null
      if (cv && score && score.score >= AUTO_LETTER_SCORE) {
        try {
          coverLetter = await generateCoverLetter(
            cv,
            { company: job.company, title: job.title, description: job.summary, requirements: job.requirements },
            "de"
          )
        } catch {
          /* optional */
        }
      }

      await supabase.from("job_applications").insert({
        company: job.company,
        title: job.title,
        url: c.url,
        portal: c.portal,
        city: job.city === "sonstige" ? c.city : job.city,
        salary: job.salary,
        description: `${job.summary}\n\n${raw.slice(0, 3000)}`,
        requirements: job.requirements,
        contact_name: job.contact_name,
        contact_email: job.contact_email,
        match_score: score?.score ?? null,
        match_reasons: score
          ? ({ hits: score.hits, missing: score.missing, verdict: score.verdict } as never)
          : null,
        cover_letter: coverLetter,
      })
      created++
      createdList.push(`${job.company} (${score?.score ?? "?"}%)`)
    } catch {
      // Detailseite blockt/Timeout — nächster Kandidat
    }
  }

  // 3) Nachfass-Entwürfe: beworben, >14 Tage still, noch kein Entwurf.
  const cutoff = new Date(Date.now() - FOLLOWUP_AFTER_DAYS * 86400_000).toISOString()
  const { data: dueJobs } = await supabase
    .from("job_applications")
    .select("id, company, title, contact_name")
    .eq("stage", "applied")
    .lt("applied_at", cutoff)
    .is("next_action", null)
    .limit(MAX_FOLLOWUP_DRAFTS)
  let followupDrafts = 0
  for (const j of dueJobs ?? []) {
    try {
      const out = await chatJSON(
        `Schreibe eine kurze, freundliche Nachfass-E-Mail (max 90 Wörter, Deutsch) zu einer Bewerbung vor ${FOLLOWUP_AFTER_DAYS}+ Tagen. Kein Druck, echtes Interesse, konkrete Frage nach dem Stand. Antworte NUR als JSON: {"mail":"..."}`,
        `Firma: ${j.company}, Stelle: ${j.title}${j.contact_name ? `, Ansprechperson: ${j.contact_name}` : ""}`,
        "job_followup"
      )
      const mail = (JSON.parse(out) as { mail?: string }).mail
      if (mail) {
        await supabase
          .from("job_applications")
          .update({ next_action: `Nachfassen — Entwurf:\n${mail}`, updated_at: new Date().toISOString() })
          .eq("id", j.id)
        followupDrafts++
      }
    } catch {
      /* nächster */
    }
  }

  if (created || followupDrafts) {
    await sendPushToAll({
      title: "JobOS",
      body: [
        created ? `${created} neue Stelle${created > 1 ? "n" : ""}: ${createdList.join(", ")}` : null,
        followupDrafts ? `${followupDrafts} Nachfass-Entwurf${followupDrafts > 1 ? "e" : ""}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 120),
      url: "/jobs",
    }).catch(() => {})
  }

  return NextResponse.json({ terms, candidates: candidates.length, created, createdList, followupDrafts })
}
