import Link from "next/link"
import type { Enums } from "@/lib/database.types"
import { STAGE_LABELS } from "@/lib/dbLabels"
import { moduleStyle, type SignalModule } from "@/lib/modules"

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

/** Kleines farbiges Modul-Etikett (Inbox, Feed, Palette). */
export function ModuleChip({ module }: { module: SignalModule }) {
  const s = moduleStyle(module)
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium ${s.text} ${s.bg} ${s.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

/** Bento-Kachel: klickbare Modul-Übersicht mit Kennzahl + optionaler Sparkline. */
export function ModuleTile({
  href,
  module,
  value,
  label,
  sub,
  children,
}: {
  href: string
  module: SignalModule
  value: string
  label: string
  sub?: string | null
  children?: React.ReactNode
}) {
  const s = moduleStyle(module)
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-3 transition-colors hover:border-zinc-600"
    >
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${s.text}`}>{s.label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-zinc-400">{label}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-zinc-500">{sub}</p>}
      {children && <div className="mt-2">{children}</div>}
    </Link>
  )
}

/** Leerer Zustand mit Handlungsimpuls statt leerer Tabelle. */
export function EmptyState({
  icon,
  text,
  action,
}: {
  icon: string
  text: string
  action?: { href: string; label: string }
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <span className="text-3xl opacity-60">{icon}</span>
      <p className="text-sm text-zinc-500">{text}</p>
      {action && (
        <Link href={action.href} className="text-sm text-rose-400 hover:underline">
          {action.label} →
        </Link>
      )}
    </div>
  )
}

export const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500"
export const btnCls =
  "rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
export const btnGhostCls =
  "rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
