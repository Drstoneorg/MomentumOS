import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { collectSignals, PRIO_LABELS, type Signal } from "@/lib/signals"
import { ModuleChip, EmptyState } from "@/components/ui"
import { FollowupDone } from "@/components/FollowupDone"
import { QuickReply } from "@/components/QuickReply"

export const dynamic = "force-dynamic"

/**
 * Kommando-Zentrale: alle Signale aller Module als eine Abarbeitungsliste.
 * Statt sechs Seiten zu checken: hier durchgehen, Punkt für Punkt.
 */
export default async function InboxPage() {
  const supabase = await createClient()
  const signals = await collectSignals(supabase)

  const groups: { prio: 0 | 1 | 2; items: Signal[] }[] = ([0, 1, 2] as const)
    .map((prio) => ({ prio, items: signals.filter((s) => s.prio === prio) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl font-bold">📥 Inbox</h1>
        <p className="text-sm text-zinc-500">
          {signals.length === 0
            ? "alles abgearbeitet"
            : `${signals.length} Signal${signals.length === 1 ? "" : "e"} aus allen Modulen`}
        </p>
      </div>

      {signals.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          <EmptyState
            icon="🏝"
            text="Nichts offen — alle Module ruhig. Genieß es."
            action={{ href: "/", label: "Zum Dashboard" }}
          />
        </div>
      )}

      {groups.map((g) => (
        <section key={g.prio}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            {PRIO_LABELS[g.prio]} ({g.items.length})
          </h2>
          <ul className="space-y-2">
            {g.items.map((s) => (
              <li
                key={s.key}
                className={`rounded-xl border bg-zinc-900 p-3 ${
                  s.prio === 0 ? "border-amber-800/70" : "border-zinc-800"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg">{s.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={s.href} className="font-medium text-white hover:underline">
                        {s.title}
                      </Link>
                      <ModuleChip module={s.module} />
                    </div>
                    {s.detail && <p className="mt-0.5 text-sm text-zinc-400">{s.detail}</p>}
                    {s.contactId && s.module === "match" && <QuickReply contactId={s.contactId} />}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.followupId && <FollowupDone id={s.followupId} />}
                    <Link
                      href={s.href}
                      className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      Öffnen
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="text-xs text-zinc-600">
        Gleiche Quelle wie Dashboard-Feed und Morgen-Briefing — was hier steht, ist überall
        konsistent. Warnungen ganz oben, dann heute, dann demnächst.
      </p>
    </div>
  )
}
