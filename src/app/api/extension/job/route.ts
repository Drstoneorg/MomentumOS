import { NextResponse } from "next/server"
import { authExtension } from "@/lib/extensionAuth"
import { extractJob, scoreJob, generateCoverLetter, type CvProfile } from "@/lib/ai/jobs"
import { findDuplicateJob } from "@/lib/jobDedupe"

// Ab diesem Match-Score wird das Anschreiben direkt mitgeneriert (liegt dann fertig in JobOS).
const AUTO_LETTER_SCORE = 65

export const maxDuration = 60

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

/**
 * JobOS-Erfassung aus der Extension: roher Seitentext einer Stellenanzeige →
 * extrahieren, gegen CV-Profil scoren, in job_applications speichern.
 */
export async function POST(req: Request) {
  const supabase = await authExtension(req)
  if (supabase === "rate_limited") {
    return NextResponse.json({ error: "Rate-Limit erreicht — in einer Stunde wieder" }, { status: 429, headers: cors })
  }
  if (!supabase) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: cors })
  }

  const { raw, url, portal } = await req.json()
  if (!raw || typeof raw !== "string" || raw.trim().length < 30) {
    return NextResponse.json({ error: "Zu wenig Text" }, { status: 400, headers: cors })
  }

  try {
    const job = await extractJob(raw, url)
    const { data: cvRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "job_cv_profile")
      .maybeSingle()
    const cv = (cvRow?.value as CvProfile | null) ?? null
    const score = cv ? await scoreJob(cv, job) : null

    // Dedupe: normalisierte URL oder Firma+Titel-Fingerprint (Portal-übergreifend)
    const dup = await findDuplicateJob(supabase, { company: job.company, title: job.title, url })
    if (dup) {
      return NextResponse.json(
        { duplicate: true, company: job.company, title: job.title, score: score?.score ?? null },
        { headers: cors }
      )
    }

    // Guter Match → Anschreiben sofort mitgenerieren (ein Klick weniger später)
    let coverLetter: string | null = null
    if (cv && score && score.score >= AUTO_LETTER_SCORE) {
      try {
        coverLetter = await generateCoverLetter(
          cv,
          { company: job.company, title: job.title, description: job.summary, requirements: job.requirements },
          "de"
        )
      } catch {
        // Anschreiben optional — Erfassung zählt
      }
    }

    const { error } = await supabase.from("job_applications").insert({
      company: job.company,
      title: job.title,
      url: url ?? null,
      portal: portal ?? null,
      city: job.city,
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
    if (error) throw new Error(error.message)

    return NextResponse.json(
      {
        duplicate: false,
        company: job.company,
        title: job.title,
        city: job.city,
        score: score?.score ?? null,
        verdict: score?.verdict ?? (cv ? "" : "Kein CV-Profil — in JobOS Lebenslauf speichern für Match-Score."),
        missing: score?.missing ?? [],
      },
      { headers: cors }
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500, headers: cors }
    )
  }
}
