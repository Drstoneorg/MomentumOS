"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { archiveContacts } from "@/lib/actions"

/**
 * Auto-Archiv-Vorwarnung: Kontakte 60-90 Tage ohne Aktivität. Ab 90 Tagen
 * archiviert der Followups-Cron automatisch — hier kann man es vorziehen
 * oder einzelne noch retten (einfach anschreiben, dann zählt neue Aktivität).
 */
export function ArchiveCandidates({
  candidates,
}: {
  candidates: { id: string; name: string; days: number }[]
}) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  if (!candidates.length || done) return null

  return (
    <div className="space-y-2 text-sm">
      <ul className="space-y-1">
        {candidates.map((c) => (
          <li key={c.id}>
            <Link href={`/contacts/${c.id}`} className="font-medium text-white hover:underline">
              {c.name}
            </Link>{" "}
            <span className="text-zinc-500">{c.days}d ohne Aktivität</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500">
        Ab 90 Tagen archiviert der nächtliche Cron automatisch (umkehrbar, nichts wird gelöscht).
      </p>
      <button
        onClick={() =>
          startTransition(async () => {
            await archiveContacts(candidates.map((c) => c.id))
            setDone(true)
          })
        }
        disabled={pending}
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "Archiviere…" : `Alle ${candidates.length} jetzt archivieren`}
      </button>
    </div>
  )
}
