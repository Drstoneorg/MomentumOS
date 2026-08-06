"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { mergeContacts } from "@/lib/actions"

type Seite = { id: string; name: string; platform: string }

/** Richtungswahl: welcher der beiden Kontakte überlebt. */
export function MergePair({ a, b }: { a: Seite; b: Seite }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)

  function merge(keep: Seite, drop: Seite) {
    if (
      !confirm(
        `„${drop.name}“ (${drop.platform}) in „${keep.name}“ (${keep.platform}) aufgehen lassen?\n` +
          "Nachrichten, Gedächtnis und Termine wandern mit, der zweite Eintrag verschwindet."
      )
    )
      return
    start(async () => {
      try {
        await mergeContacts(keep.id, drop.id)
        router.refresh()
      } catch (e) {
        setFehler(e instanceof Error ? e.message : "Merge fehlgeschlagen")
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          onClick={() => merge(a, b)}
          disabled={pending}
          className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          title={`${b.name} in ${a.name} aufgehen lassen`}
        >
          {pending ? "…" : `→ in „${a.name}“ behalten`}
        </button>
        <button
          onClick={() => merge(b, a)}
          disabled={pending}
          className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          title={`${a.name} in ${b.name} aufgehen lassen`}
        >
          {pending ? "…" : `→ in „${b.name}“ behalten`}
        </button>
      </div>
      {fehler && <p className="text-xs text-red-400">{fehler}</p>}
    </div>
  )
}
