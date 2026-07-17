"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Enums } from "@/lib/database.types"
import { createArtist } from "@/lib/artistActions"
import { ARTIST_TYPE_LABELS } from "@/lib/artists"
import { btnCls, inputCls } from "@/components/ui"

export function NewArtistButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState("")
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const res = await createArtist({
        name: String(fd.get("name")),
        artistType: String(fd.get("artist_type")) as Enums<"artist_type">,
        genres: (fd.get("genres") as string) || "",
        city: (fd.get("city") as string) || "",
      })
      if (res.error || !res.id) {
        setMsg(res.error ?? "Anlegen fehlgeschlagen")
        return
      }
      setOpen(false)
      router.push(`/book/artists/${res.id}`)
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={btnCls}>+ Artist</button>
      {open && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold">Neuer Artist</h2>
            <input name="name" required placeholder="Artist-Name" className={inputCls} />
            <select name="artist_type" className={inputCls} defaultValue="dj">
              {Object.entries(ARTIST_TYPE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
            <input name="genres" placeholder="Genres, kommagetrennt (z.B. Techno, EBM)" className={inputCls} />
            <input name="city" placeholder="Stadt" className={inputCls} />
            {msg && <p className="text-sm text-rose-400">{msg}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-zinc-400">Abbrechen</button>
              <button type="submit" disabled={pending} className={btnCls}>{pending ? "…" : "Anlegen"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
