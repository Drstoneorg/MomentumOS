"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createMeetup } from "@/lib/momentsActions"
import { btnCls, inputCls } from "@/components/ui"

export function NewMeetupButton({ contacts }: { contacts: { id: string; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const id = await createMeetup(
        { title: String(fd.get("title")), notes: (fd.get("notes") as string) || null },
        [...selected]
      )
      setOpen(false)
      router.push(`/moments/meetups/${id}`)
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={btnCls}>+ Neues Meetup</button>
      {open && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold">Neues Meetup</h2>
            <input name="title" required placeholder="Titel (z.B. Kaffee mit Yuki)" className={inputCls} />
            <textarea name="notes" placeholder="Notiz" rows={2} className={inputCls} />
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 p-2">
              <p className="text-xs text-zinc-500">Teilnehmer:</p>
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={(e) => {
                      const n = new Set(selected)
                      if (e.target.checked) n.add(c.id)
                      else n.delete(c.id)
                      setSelected(n)
                    }}
                  />
                  {c.name}
                </label>
              ))}
            </div>
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
