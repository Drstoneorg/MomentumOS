// JobOS-KI: CV-Profil extrahieren, Stellenanzeigen parsen, Match-Score, Anschreiben.
// Alles über DeepSeek (chatJSON) — läuft ohne zusätzliche Keys.

import { chatJSON } from "@/lib/ai/deepseek"

export type CvProfile = {
  name: string
  headline: string // z. B. "Marketing-Manager mit Video-Schwerpunkt"
  skills: string[]
  experience: { role: string; company: string; period: string; highlights: string[] }[]
  education: string[]
  languages: string[]
  extras: string[] // Zertifikate, Tools, Sonstiges
}

export async function extractCvProfile(raw: string): Promise<CvProfile> {
  const out = await chatJSON(
    `Du extrahierst ein strukturiertes Bewerberprofil aus Lebenslauf-Text (auch unordentlich, z. B. von Webseite kopiert).
Antworte NUR als JSON:
{"name":"","headline":"","skills":["..."],"experience":[{"role":"","company":"","period":"","highlights":["..."]}],"education":["..."],"languages":["..."],"extras":["..."]}
Regeln: nichts erfinden; Fakten wörtlich übernehmen; headline = prägnante Selbstbeschreibung aus den Daten; max 25 skills.`,
    raw.slice(0, 12000),
    "job_cv"
  )
  const p = JSON.parse(out) as Partial<CvProfile>
  return {
    name: p.name ?? "",
    headline: p.headline ?? "",
    skills: Array.isArray(p.skills) ? p.skills.slice(0, 30) : [],
    experience: Array.isArray(p.experience) ? p.experience.slice(0, 15) : [],
    education: Array.isArray(p.education) ? p.education : [],
    languages: Array.isArray(p.languages) ? p.languages : [],
    extras: Array.isArray(p.extras) ? p.extras : [],
  }
}

export type ExtractedJob = {
  company: string
  title: string
  city: "wien" | "berlin" | "remote" | "sonstige"
  salary: string | null
  requirements: string[]
  summary: string
  contact_name: string | null
  contact_email: string | null
}

export async function extractJob(raw: string, sourceUrl?: string): Promise<ExtractedJob> {
  const out = await chatJSON(
    `Du extrahierst eine Stellenanzeige aus rohem Seitentext (Jobportal, evtl. mit Navigations-Müll).
Antworte NUR als JSON:
{"company":"","title":"","city":"wien|berlin|remote|sonstige","salary":null,"requirements":["..."],"summary":"","contact_name":null,"contact_email":null}
Regeln: nichts erfinden. city: "wien" wenn Wien/Österreich-Umland, "berlin" wenn Berlin, "remote" wenn vollständig remote, sonst "sonstige".
salary: Angabe wörtlich (z. B. "ab € 3.200 brutto/Monat") oder null. requirements: die 5-10 wichtigsten Anforderungen kurz. summary: 2 Sätze, was der Job ist.`,
    `${sourceUrl ? `URL: ${sourceUrl}\n` : ""}${raw.slice(0, 10000)}`,
    "job_extract"
  )
  const j = JSON.parse(out) as Partial<ExtractedJob>
  const city = (["wien", "berlin", "remote", "sonstige"] as const).includes(
    j.city as ExtractedJob["city"]
  )
    ? (j.city as ExtractedJob["city"])
    : "sonstige"
  return {
    company: j.company?.trim() || "Unbekannt",
    title: j.title?.trim() || "Stelle",
    city,
    salary: j.salary ?? null,
    requirements: Array.isArray(j.requirements) ? j.requirements.slice(0, 12) : [],
    summary: j.summary ?? "",
    contact_name: j.contact_name ?? null,
    contact_email: j.contact_email ?? null,
  }
}

export type JobScore = { score: number; hits: string[]; missing: string[]; verdict: string }

export async function scoreJob(cv: CvProfile, job: ExtractedJob): Promise<JobScore> {
  const out = await chatJSON(
    `Du bewertest, wie gut ein Bewerberprofil zu einer Stelle passt.
Antworte NUR als JSON: {"score":0-100,"hits":["erfüllte Anforderungen"],"missing":["fehlende Anforderungen"],"verdict":"1 ehrlicher Satz"}
Streng aber fair: score >70 nur bei klarer Passung der Kernanforderungen.`,
    `BEWERBER:\n${JSON.stringify(cv)}\n\nSTELLE:\n${JSON.stringify(job)}`,
    "job_score"
  )
  const s = JSON.parse(out) as Partial<JobScore>
  return {
    score: Math.max(0, Math.min(100, Number(s.score) || 0)),
    hits: Array.isArray(s.hits) ? s.hits.slice(0, 8) : [],
    missing: Array.isArray(s.missing) ? s.missing.slice(0, 8) : [],
    verdict: s.verdict ?? "",
  }
}

export async function generateCoverLetter(
  cv: CvProfile,
  job: { company: string; title: string; description: string | null; requirements: string[] },
  language: "de" | "en",
  wishes?: string
): Promise<string> {
  const out = await chatJSON(
    `Du schreibst ein Bewerbungsanschreiben (${language === "en" ? "Englisch" : "Deutsch"}).
Antworte NUR als JSON: {"letter":"..."}
Regeln: konkret auf die Stelle eingehen, echte Stärken aus dem Profil belegen (keine Floskeln wie "hiermit bewerbe ich mich"), selbstbewusst aber nicht übertrieben, 200-300 Wörter, keine erfundenen Erfahrungen, moderne direkte Sprache. Anrede generisch wenn kein Name bekannt.${
      wishes ? ` Zusätzliche Wünsche des Bewerbers: ${wishes}` : ""
    }`,
    `BEWERBER:\n${JSON.stringify(cv)}\n\nSTELLE:\n${JSON.stringify(job)}`,
    "job_cover_letter"
  )
  return (JSON.parse(out) as { letter?: string }).letter ?? ""
}
