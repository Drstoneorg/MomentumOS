import type { Enums } from "@/lib/database.types"
import { STAGE_LABELS } from "@/lib/database.types"

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-xl border border-zinc-800 bg-zinc-900 p-4 ${className}`}
    >
      {title && (
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

const stageColors: Partial<Record<Enums<"pipeline_stage">, string>> = {
  new_match: "bg-sky-900/60 text-sky-300",
  chatting: "bg-emerald-900/60 text-emerald-300",
  interest_visible: "bg-emerald-800/60 text-emerald-200",
  date_proposed: "bg-amber-900/60 text-amber-300",
  scheduling: "bg-amber-800/60 text-amber-200",
  date_planned: "bg-rose-900/60 text-rose-300",
  calendar_created: "bg-rose-800/60 text-rose-200",
  archived: "bg-zinc-800 text-zinc-500",
}

export function StageBadge({ stage }: { stage: Enums<"pipeline_stage"> }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
        stageColors[stage] ?? "bg-zinc-800 text-zinc-300"
      }`}
    >
      {STAGE_LABELS[stage]}
    </span>
  )
}

export function PriorityDot({ priority }: { priority: Enums<"priority_level"> }) {
  const color =
    priority === "high"
      ? "bg-rose-500"
      : priority === "low"
        ? "bg-zinc-600"
        : "bg-amber-500"
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} title={priority} />
}

export const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500"
export const btnCls =
  "rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
export const btnGhostCls =
  "rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
