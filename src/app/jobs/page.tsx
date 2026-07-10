import { createClient } from "@/lib/supabase/server"
import { JobsClient } from "./JobsClient"
import type { CvProfile } from "@/lib/ai/jobs"

export const dynamic = "force-dynamic"

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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">💼 JobOS — Bewerbungen</h1>
      <JobsClient
        jobs={jobs ?? []}
        cv={(cvRow?.value as CvProfile | null) ?? null}
        autoTerms={autoTerms}
      />
    </div>
  )
}
