"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createContact, addChannel } from "@/lib/actions"
import { updateFriendMeta } from "@/lib/momentsActions"
import { CHANNEL_IDS } from "@/lib/channels"
import { btnCls, inputCls } from "@/components/ui"

const PLATFORMS = [
  "freund", "tinder", "bumble", "hinge", "boo", "pairs", "tantan", "badoo",
  "instagram", "telegram", "sonstige",
]

type Fields = {
  name: string
  platform: string
  age: string
  location: string
  language: string
  birthday: string
  tags: string
  channel: string
  handle: string
  bio: string
  notes: string
}

const empty: Fields = {
  name: "", platform: "freund", age: "", location: "", language: "de",
  birthday: "", tags: "", channel: "", handle: "", bio: "", notes: "",
}

export function QuickAddContact() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<Fields>(empty)
  const [raw, setRaw] = useState("")
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((v) => ({ ...v, [k]: e.target.value }))

  async function parse() {
    setParsing(true)
    setError(null)
    const res = await fetch("/api/import/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    })
    const data = await res.json()
    setParsing(false)
    if (!res.ok) {
      setError(data.error ?? "Parse-Fehler")
      return
    }
    setF((v) => ({
      ...v,
      name: data.name || v.name,
      age: data.age ? String(data.age) : v.age,
      location: data.location || v.location,
      language: data.language || v.language,
      platform: data.platform && PLATFORMS.includes(data.platform) ? data.platform : v.platform,
      bio: data.bio || v.bio,
      notes: [data.notes, (data.interests ?? []).join(", ")].filter(Boolean).join(" · ") || v.notes,
    }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      try {
        const id = await createContact({
          name: f.name.trim(),
          platform: f.platform,
          age: f.age ? Number(f.age) : null,
          location: f.location || null,
          language: f.language,
          bio: f.bio || null,
          notes: f.notes || null,
        })
        if (f.birthday || f.tags) {
          await updateFriendMeta(id, {
            birthday: f.birthday || null,
            relationship_tags: f.tags
              ? f.tags.split(",").map((t) => t.trim()).filter(Boolean)
              : [],
          })
        }
        if (f.channel && f.handle.trim()) {
          await addChannel({
            contact_id: id,
            channel: f.channel,
            handle: f.handle.trim(),
            is_primary: true,
          })
        }
        setOpen(false)
        setF(empty)
        setRaw("")
        router.push(`/contacts/${id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Anlegen")
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Kontakt schnell anlegen"
        className="rounded-lg border border-zinc-700 px-2.5 py-1 text-sm text-zinc-300 hover:bg-zinc-800"
      >
        + Kontakt
      </button>
      {open && (
        <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10">
          <form
            onSubmit={submit}
            className="w-full max-w-lg space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <h2 className="text-lg font-semibold">Kontakt schnell anlegen</h2>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={2}
                placeholder={"Freitext: „Lisa, 27, Wien, Instagram @lisa, mag Yoga…“"}
                className={inputCls}
              />
              <button
                type="button"
                onClick={parse}
                disabled={parsing || !raw.trim()}
                className="mt-2 rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                {parsing ? "KI liest…" : "✨ KI füllt Felder aus"}
              </button>
            </div>

            <input value={f.name} onChange={set("name")} required placeholder="Name *" className={inputCls} />
            <div className="flex gap-3">
              <select value={f.platform} onChange={set("platform")} className={inputCls}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input value={f.age} onChange={set("age")} type="number" placeholder="Alter" className={inputCls} />
            </div>
            <div className="flex gap-3">
              <input value={f.location} onChange={set("location")} placeholder="Ort" className={inputCls} />
              <input value={f.birthday} onChange={set("birthday")} type="date" title="Geburtstag" className={inputCls} />
            </div>
            <input value={f.tags} onChange={set("tags")} placeholder="Tags (komma-getrennt: uni, kernfreunde)" className={inputCls} />
            <div className="flex gap-3">
              <select value={f.channel} onChange={set("channel")} className={inputCls}>
                <option value="">Kanal (optional)</option>
                {CHANNEL_IDS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={f.handle} onChange={set("handle")} placeholder="Handle / Nummer" className={inputCls} />
            </div>
            <textarea value={f.notes} onChange={set("notes")} rows={2} placeholder="Notizen" className={inputCls} />

            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-zinc-400">
                Abbrechen
              </button>
              <button type="submit" disabled={pending || !f.name.trim()} className={btnCls}>
                {pending ? "…" : "Anlegen"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
