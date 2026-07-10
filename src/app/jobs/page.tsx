import { createClient } from "@/lib/supabase/server"
import { JobsClient } from "./JobsClient"
import type { CvProfile } from "@/lib/ai/jobs"

export const dynamic = "force-dynamic"

export default async function JobsPage() {
  const supabase = await createClient()
  const [{ data: jobs }, { data: cvRow }] = await Promise.all([
    supabase.from("job_applications").select("*").order("created_at", { ascending: false }),
    supabase.from("settings").select("value").eq("key", "job_cv_profile").maybeSingle(),
  ])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">💼 JobOS — Bewerbungen</h1>
      <JobsClient jobs={jobs ?? []} cv={(cvRow?.value as CvProfile | null) ?? null} />
    </div>
  )
}
