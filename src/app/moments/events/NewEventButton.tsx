"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createEvent } from "@/lib/momentsActions"
import { btnCls, inputCls } from "@/components/ui"

export function NewEventButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const id = await createEvent({
        title: String(fd.get("title")),
        starts_at: fd.get("starts_at") ? new Date(String(fd.get("starts_at"))).toISOString() : null,
        location: (fd.get("location") as string) || null,
        description: (fd.get("description") as string) || null,
        capacity: fd.get("capacity") ? Number(fd.get("capacity")) : null,
      })
      setOpen(false)
      router.push(`/moments/events/${id}`)
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={btnCls}>+ Neues Event</button>
      {open && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold">Neues Event</h2>
            <input name="title" required placeholder="Titel (z.B. Dokomi 2026)" className={inputCls} />
            <input name="starts_at" type="datetime-local" className={inputCls} />
            <input name="location" placeholder="Ort" className={inputCls} />
            <div className="flex gap-2">
              <input name="capacity" type="number" placeholder="Kapazität" className={inputCls} />
            </div>
            <textarea name="description" placeholder="Beschreibung" rows={2} className={inputCls} />
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
