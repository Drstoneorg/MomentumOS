import { createClient } from "@/lib/supabase/server"
import { JobsClient } from "./JobsClient"
import { Card } from "@/components/ui"
import type { CvProfile } from "@/lib/ai/jobs"

export const dynamic = "force-dynamic"

// Ab "applied" gilt: beworben. Alles danach ist eine Reaktion der Firma.
const APPLIED_STAGES = ["applied", "answered", "interview", "offer", "rejected"]
const RESPONSE_STAGES = ["answered", "interview", "offer", "rejected"]

type FunnelRow = {
  portal: string
  applied: number
  responses: number
  interviews: number
  offers: number
}

function funnelByPortal(jobs: { portal: string | null; stage: string }[]): FunnelRow[] {
  const map = new Map<string, FunnelRow>()
  for (const j of jobs) {
    if (!APPLIED_STAGES.includes(j.stage)) continue
    const key = j.portal?.trim() || "unbekannt"
    const row = map.get(key) ?? { portal: key, applied: 0, responses: 0, interviews: 0, offers: 0 }
    row.applied++
    if (RESPONSE_STAGES.includes(j.stage)) row.responses++
    if (j.stage === "interview" || j.stage === "offer") row.interviews++
    if (j.stage === "offer") row.offers++
    map.set(key, row)
  }
  return [...map.values()].sort((a, b) => b.applied - a.applied)
}

export default async function JobsPage() {
  const supabase = await createClient()
  const [{ data: jobs }, { data: cvRow }, { data: autoRow }] = await Promise.all([
    supabase.from("job_applications").select("*").order("created_at", { ascending: false }),
    supabase.from("settings").select("value").eq("key", "job_cv_profile").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "job_auto_search").maybeSingle(),
  ])

  let autoTerms: string[] = []
  try {
    const parsed =
      typeof autoRow?.value === "string" ? JSON.parse(autoRow.value) : autoRow?.value
    autoTerms = Array.isArray((parsed as { terms?: string[] } | null)?.terms)
      ? (parsed as { terms: string[] }).terms
      : []
  } catch {
    /* keine Config */
  }

  const funnel = funnelByPortal(jobs ?? [])
  const totals = funnel.reduce(
    (t, r) => ({
      portal: "gesamt",
      applied: t.applied + r.applied,
      responses: t.responses + r.responses,
      interviews: t.interviews + r.interviews,
      offers: t.offers + r.offers,
    }),
    { portal: "gesamt", applied: 0, responses: 0, interviews: 0, offers: 0 }
  )
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—")

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">💼 JobOS — Bewerbungen</h1>

      {totals.applied > 0 && (
        <Card title="📊 Funnel pro Portal — wo lohnt sich bewerben?">
          <table className="w-full text-xs">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-1">Portal</th>
                <th className="py-1 text-right">Beworben</th>
                <th className="py-1 text-right">Antworten</th>
                <th className="py-1 text-right">Quote</th>
                <th className="py-1 text-right">Interviews</th>
                <th className="py-1 text-right">Angebote</th>
              </tr>
            </thead>
            <tbody>
              {funnel.map((r) => (
                <tr key={r.portal} className="border-t border-zinc-800/60">
                  <td className="py-1 text-zinc-200">{r.portal}</td>
                  <td className="py-1 text-right text-zinc-400">{r.applied}</td>
                  <td className="py-1 text-right text-zinc-400">{r.responses}</td>
                  <td className="py-1 text-right tabular-nums text-zinc-200">{pct(r.responses, r.applied)}</td>
                  <td className="py-1 text-right text-sky-300">{r.interviews}</td>
                  <td className="py-1 text-right text-emerald-400">{r.offers}</td>
                </tr>
              ))}
              <tr className="border-t border-zinc-700 font-medium">
                <td className="py-1 text-zinc-100">Gesamt</td>
                <td className="py-1 text-right text-zinc-300">{totals.applied}</td>
                <td className="py-1 text-right text-zinc-300">{totals.responses}</td>
                <td className="py-1 text-right tabular-nums text-zinc-100">{pct(totals.responses, totals.applied)}</td>
                <td className="py-1 text-right text-sky-300">{totals.interviews}</td>
                <td className="py-1 text-right text-emerald-400">{totals.offers}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-zinc-600">
            Portale ohne Antworten trotz vieler Bewerbungen sind Zeitverschwendung — Energie dorthin, wo die Quote stimmt.
          </p>
        </Card>
      )}

      <JobsClient
        jobs={jobs ?? []}
        cv={(cvRow?.value as CvProfile | null) ?? null}
        autoTerms={autoTerms}
      />
    </div>
  )
}
