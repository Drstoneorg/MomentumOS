"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { Signal } from "@/lib/signals"
import { ModuleChip, EmptyState } from "@/components/ui"
import { SignalActions } from "@/components/SignalActions"
import { FollowupDone } from "@/components/FollowupDone"
import { QuickReply } from "@/components/QuickReply"
import { PRIO_LABELS } from "@/lib/signals"

export function FocusClient({ signals }: { signals: Signal[] }) {
  const [index, setIndex] = useState(0)
  const [handled, setHandled] = useState(0)

  const total = signals.length
  const current = signals[index]
  const done = index >= total

  // Tastatur: → oder n = weiter, ← = zurück (Enter bleibt den Buttons überlassen)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return
      if (e.key === "ArrowRight" || e.key === "n") {
        setIndex((i) => Math.min(i + 1, total))
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(i - 1, 0))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [total])

  if (total === 0 || done) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
        <EmptyState
          icon="🏝"
          text={
            total === 0
              ? "Nichts offen — alle Module ruhig."
              : `Durch! ${total} Signal${total === 1 ? "" : "e"} durchgearbeitet${handled ? `, ${handled} direkt erledigt` : ""}.`
          }
          action={{ href: "/", label: "Zum Dashboard" }}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold">▶ Fokus</h1>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-rose-600 transition-all"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
        <span className="text-sm text-zinc-400">
          {index + 1} / {total}
        </span>
      </div>

      <div
        className={`rounded-2xl border bg-zinc-900 p-5 ${
          current.prio === 0 ? "border-amber-800/70" : "border-zinc-700"
        }`}
      >
        <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
          <span>{PRIO_LABELS[current.prio]}</span>
          <ModuleChip module={current.module} />
        </div>
        <p className="text-lg font-semibold text-white">
          <span className="mr-2">{current.icon}</span>
          <Link href={current.href} className="hover:underline">
            {current.title}
          </Link>
        </p>
        {current.detail && <p className="mt-1 text-sm text-zinc-400">{current.detail}</p>}

        <div className="mt-3">
          {current.contactId && current.module === "match" && (
            <QuickReply contactId={current.contactId} />
          )}
          <SignalActions signal={current} />
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-zinc-800 pt-3">
          {current.followupId && (
            <span
              onClick={() => {
                setHandled((h) => h + 1)
                setIndex((i) => i + 1)
              }}
            >
              <FollowupDone id={current.followupId} />
            </span>
          )}
          <Link
            href={current.href}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Öffnen
          </Link>
          <button
            onClick={() => setIndex((i) => i + 1)}
            className="ml-auto rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-500"
          >
            Weiter →
          </button>
        </div>
      </div>

      <p className="text-center text-[11px] text-zinc-600">
        Tastatur: → weiter · ← zurück — Aktionen wirken sofort, „Weiter&quot; überspringt nur die Ansicht
      </p>
    </div>
  )
}
