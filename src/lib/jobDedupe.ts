import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

/**
 * Job-Dedupe: gleiches Inserat auf zwei Portalen (oder zweimal gescannt) darf
 * nicht zu zwei Bewerbungen führen. Zwei Signale:
 * - normalisierte URL (Tracking-Parameter/Hash/Slash weg, ID-Parameter bleiben)
 * - Firma+Titel-Fingerprint ("(m/w/d)"-Varianten, Satzzeichen, Casing egal)
 */

// Nur Tracking entfernen — Portale wie Indeed tragen die Job-ID im Query (?jk=…),
// kompletter Query-Strip würde verschiedene Jobs zusammenwerfen.
const TRACKING_PARAMS = /^(utm_|ref$|referer$|source$|src$|fbclid$|gclid$|trk$|tracking|cmp$|campaign)/i

export function normalizeJobUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    u.hash = ""
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "")
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key)
    }
    u.searchParams.sort()
    let s = u.toString().replace(/\/+$/, "")
    s = s.replace(/^https?:\/\//, "") // http vs https egal
    return s.toLowerCase()
  } catch {
    return url.trim().toLowerCase() || null
  }
}

// "(m/w/d)", "(w/m/x)", "all genders" etc. sind Rausch-Suffixe deutscher Inserate
const GENDER_NOISE = /\((?:[mwdx]\s*\/\s*){1,3}[mwdx]\)|\ball genders?\b|\(f\/m\/d\)/gi

export function jobKey(company: string, title: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(GENDER_NOISE, " ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
  return `${norm(company)}|${norm(title)}`
}

/** Sucht ein Duplikat über URL oder Fingerprint. Liefert die id oder null. */
export async function findDuplicateJob(
  supabase: SupabaseClient<Database>,
  job: { company: string; title: string; url?: string | null }
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("job_applications")
    .select("id, company, title, url")
    .order("created_at", { ascending: false })
    .limit(500)
  if (!existing?.length) return null

  const myUrl = normalizeJobUrl(job.url)
  const myKey = jobKey(job.company, job.title)
  for (const e of existing) {
    if (myUrl && normalizeJobUrl(e.url) === myUrl) return e.id
    if (jobKey(e.company, e.title) === myKey) return e.id
  }
  return null
}
