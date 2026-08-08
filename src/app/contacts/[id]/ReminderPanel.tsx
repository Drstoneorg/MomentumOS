"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createReminder, doneReminder } from "@/lib/actions"
import { Card, btnGhostCls, inputCls } from "@/components/ui"

type Reminder = { id: string; due_at: string; note: string | null }

/** Außerhalb der Komponente wegen react-hooks/purity (Date.now im Render). */
function istFaellig(dueAt: string): boolean {
  return new Date(dueAt).getTime() <= Date.now()
}

/**
 * Wiedervorlage am Kontakt: „in 3 Tagen melden" mit einem Klick. Fällige
 * Erinnerungen tauchen als Signal im Cockpit auf und werden hier abgehakt.
 */
export function ReminderPanel({
  contactId,
  reminders,
}: {
  contactId: string
  reminders: Reminder[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [notiz, setNotiz] = useState("")

  function setzen(tage: number) {
    start(async () => {
      await createReminder(contactId, tage, notiz.trim() || "melden")
      setNotiz("")
      router.refresh()
    })
  }

  return (
    <Card title="⏰ Wiedervorlage">
      <div className="space-y-2">
        {reminders.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-sm">
            <span className="text-zinc-200">{r.note ?? "melden"}</span>
            <span className="text-xs text-zinc-500">
              {new Date(r.due_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
              {istFaellig(r.due_at) ? " · fällig" : ""}
            </span>
            <button
              className="ml-auto rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-800"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await doneReminder(r.id, contactId)
                  router.refresh()
                })
              }
            >
              ✓ erledigt
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="Woran erinnern? (optional)"
            maxLength={200}
            className={inputCls + " min-w-40 flex-1"}
          />
          {[3, 7, 30].map((t) => (
            <button key={t} className={btnGhostCls} disabled={pending} onClick={() => setzen(t)}>
              +{t}d
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-600">Fällige Wiedervorlagen erscheinen im Cockpit als Signal</p>
      </div>
    </Card>
  )
}
