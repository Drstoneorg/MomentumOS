"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { addRecruitContact } from "./actions"

/** Einzelerfassung von Hand — bewusst kein Import, kein Crawler. */
export function QuickAddModel() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [instagram, setInstagram] = useState("")
  const [city, setCity] = useState("")
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const save = () =>
    startTransition(async () => {
      const res = await addRecruitContact({ name, instagram, city })
      if (res.error) {
        setFehler(res.error)
        return
      }
      setName("")
      setInstagram("")
      setCity("")
      setFehler(null)
      setOpen(false)
      router.refresh()
    })

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-fuchsia-800/60 bg-fuchsia-950/40 px-3 py-1.5 text-sm text-fuchsia-200 hover:bg-fuchsia-950/60"
      >
        + Model erfassen
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
      <input
        autoFocus
        placeholder="Name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-32 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm"
      />
      <input
        placeholder="@instagram"
        value={instagram}
        onChange={(e) => setInstagram(e.target.value)}
        className="w-36 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm"
      />
      <input
        placeholder="Stadt"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className="w-28 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm"
      />
      <button
        onClick={save}
        disabled={pending || !name.trim()}
        className="rounded-md bg-fuchsia-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "…" : "Speichern"}
      </button>
      <button onClick={() => setOpen(false)} className="px-2 py-1.5 text-sm text-zinc-400">
        Abbrechen
      </button>
      {fehler && <p className="w-full text-xs text-red-400">{fehler}</p>}
    </div>
  )
}
