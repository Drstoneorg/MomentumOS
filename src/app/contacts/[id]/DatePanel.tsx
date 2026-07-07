"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { addDate } from "@/lib/actions"
import type { Tables } from "@/lib/database.types"
import { Card, inputCls, btnCls } from "@/components/ui"

export function DatePanel({
  contactId,
  dates,
}: {
  contactId: string
  dates: Tables<"dates">[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const when = String(fd.get("when"))
    if (!when) return
    const form = e.currentTarget
    start(async () => {
      await addDate({
        contact_id: contactId,
        starts_at: new Date(when).toISOString(),
        place: (fd.get("place") as string) || null,
        idea: (fd.get("idea") as string) || null,
        status: "confirmed",
      })
      form.reset()
      router.refresh()
    })
  }

  return (
    <Card title="Dates">
      <ul className="mb-3 space-y-2 text-sm">
        {dates.map((d) => (
          <li key={d.id} className="rounded-lg border border-zinc-800 p-2">
            <p className="font-medium text-zinc-200">
              {new Date(d.starts_at).toLocaleString("de-DE", { dateStyle: "full", timeStyle: "short" })}
            </p>
            <p className="text-zinc-400">
              {d.place ?? "Ort offen"}
              {d.idea ? ` · ${d.idea}` : ""} · {d.status === "confirmed" ? "bestätigt" : "vorgeschlagen"}
            </p>
            <a
              href={`/api/dates/${d.id}/ics`}
              className="mt-1 inline-block text-xs text-rose-400 hover:underline"
            >
              📅 Kalender-Datei (.ics)
            </a>
          </li>
        ))}
        {!dates.length && <li className="text-zinc-500">Noch kein Date geplant.</li>}
      </ul>
      <form onSubmit={submit} className="space-y-2">
        <input name="when" type="datetime-local" required className={inputCls} />
        <div className="flex gap-2">
          <input name="place" placeholder="Ort" className={inputCls} />
          <input name="idea" placeholder="Idee (Café, Spaziergang …)" className={inputCls} />
        </div>
        <button type="submit" disabled={pending} className={btnCls + " w-full"}>
          Date eintragen
        </button>
      </form>
    </Card>
  )
}
