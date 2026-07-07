"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createContact } from "@/lib/actions"
import { btnCls, inputCls } from "@/components/ui"

const PLATFORMS = [
  "tinder", "bumble", "hinge", "boo", "pairs", "tantan", "badoo",
  "instagram", "telegram", "sonstige",
]

export function NewContactButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const id = await createContact({
        name: String(fd.get("name")),
        platform: String(fd.get("platform")),
        age: fd.get("age") ? Number(fd.get("age")) : null,
        location: (fd.get("location") as string) || null,
        language: (fd.get("language") as string) || "de",
        bio: (fd.get("bio") as string) || null,
      })
      setOpen(false)
      router.push(`/contacts/${id}`)
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={btnCls}>
        + Neues Match
      </button>
      {open && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-md space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <h2 className="text-lg font-semibold">Neues Match</h2>
            <input name="name" required placeholder="Name" className={inputCls} />
            <select name="platform" className={inputCls} defaultValue="tinder">
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <input name="age" type="number" placeholder="Alter" className={inputCls} />
              <input name="location" placeholder="Ort" className={inputCls} />
            </div>
            <select name="language" className={inputCls} defaultValue="de">
              <option value="de">Deutsch</option>
              <option value="en">Englisch</option>
              <option value="ja">Japanisch</option>
              <option value="zh">Chinesisch</option>
            </select>
            <textarea name="bio" placeholder="Bio / Profiltext" rows={3} className={inputCls} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-zinc-400">
                Abbrechen
              </button>
              <button type="submit" disabled={pending} className={btnCls}>
                {pending ? "…" : "Anlegen"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
