import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { PIPELINE_STAGES, STAGE_LABELS } from "@/lib/dbLabels"
import { PriorityDot } from "@/components/ui"

export const dynamic = "force-dynamic"

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("realm", "match")
    .order("updated_at", { ascending: false })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Pipeline</h1>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: "max-content" }}>
          {PIPELINE_STAGES.map((stage) => {
            const inStage = (contacts ?? []).filter((c) => c.pipeline_stage === stage)
            return (
              <div key={stage} className="w-56 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900">
                <div className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {STAGE_LABELS[stage]} <span className="text-zinc-600">({inStage.length})</span>
                </div>
                <div className="space-y-2 p-2">
                  {inStage.map((c) => (
                    <Link
                      key={c.id}
                      href={`/contacts/${c.id}`}
                      className="block rounded-lg border border-zinc-800 bg-zinc-950 p-2 hover:border-zinc-600"
                    >
                      <p className="flex items-center gap-2 text-sm font-medium text-white">
                        <PriorityDot priority={c.priority} /> {c.name}
                      </p>
                      <p className="text-xs text-zinc-500">{c.platform}</p>
                      {c.next_step && (
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{c.next_step}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
