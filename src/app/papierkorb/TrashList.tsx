"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { purgeTrashItem, restoreFromTrash } from "@/lib/actions"
import { btnGhostCls } from "@/components/ui"

type Eintrag = { id: string; kind: string; label: string; deleted_at: string }

/** Außerhalb der Komponente wegen react-hooks/purity (Date.now im Render). */
function tageBis(deletedAt: string): number {
  return Math.max(0, 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400_000))
}

export function TrashList({ eintraege }: { eintraege: Eintrag[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [meldung, setMeldung] = useState<string | null>(null)

  if (!eintraege.length) {
    return <p className="py-4 text-center text-sm text-zinc-500">Papierkorb ist leer 🖤</p>
  }

  return (
    <div className="space-y-1.5">
      {meldung && <p className="text-sm text-emerald-400">{meldung}</p>}
      {eintraege.map((t) => (
        <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm">
          <span className="font-medium text-white">{t.label}</span>
          <span className="text-xs text-zinc-500">
            gelöscht {new Date(t.deleted_at).toLocaleDateString("de-DE")} · noch {tageBis(t.deleted_at)} Tage
          </span>
          <span className="ml-auto flex gap-1.5">
            <button
              className={btnGhostCls}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  try {
                    const res = await restoreFromTrash(t.id)
                    setMeldung(
                      `„${res.name}" wiederhergestellt` +
                        (res.hinweise.length ? ` (${res.hinweise.join(", ")})` : "")
                    )
                    router.refresh()
                  } catch (e) {
                    setMeldung(e instanceof Error ? e.message : "Wiederherstellen fehlgeschlagen")
                  }
                })
              }
            >
              ↩ Wiederherstellen
            </button>
            <button
              className="rounded-lg border border-red-900/60 px-2.5 py-1 text-xs text-red-300 hover:bg-red-950/40"
              disabled={pending}
              onClick={() => {
                if (!confirm(`„${t.label}" endgültig löschen? Das ist nicht umkehrbar.`)) return
                start(async () => {
                  await purgeTrashItem(t.id)
                  router.refresh()
                })
              }}
            >
              Endgültig
            </button>
          </span>
        </div>
      ))}
    </div>
  )
}
