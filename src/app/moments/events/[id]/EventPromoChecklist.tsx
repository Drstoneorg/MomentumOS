"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { createPromoChecklist, togglePromoTask } from "@/lib/momentsActions"
import { Card, btnCls } from "@/components/ui"

type Aufgabe = {
  id: string
  title: string
  due_at: string
  done: boolean
}

/**
 * Promo-Fahrplan des Events: Standard-Aufgaben T-42 bis T+1, abhakbar.
 * Offene Aufgaben erscheinen zusätzlich im abonnierten Kalender-Feed.
 */
export function EventPromoChecklist({
  eventId,
  hatDatum,
  tasks,
}: {
  eventId: string
  hatDatum: boolean
  tasks: Aufgabe[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const heute = new Date().toISOString()

  if (tasks.length === 0) {
    return (
      <Card title="📣 Promo-Fahrplan">
        <p className="text-sm text-zinc-400">
          Noch keine Checkliste. Die Vorlage legt sieben Termine relativ zum Event-Datum an
          (Ankündigung T-42 bis Danke-Post T+1) — offene Punkte landen im Kalender-Feed.
        </p>
        <button
          className={btnCls + " mt-2"}
          disabled={pending || !hatDatum}
          onClick={() =>
            start(async () => {
              await createPromoChecklist(eventId)
              router.refresh()
            })
          }
        >
          {hatDatum ? (pending ? "…" : "Checkliste anlegen") : "Erst Event-Datum setzen"}
        </button>
      </Card>
    )
  }

  const offen = tasks.filter((t) => !t.done).length

  return (
    <Card title={`📣 Promo-Fahrplan (${offen} offen)`}>
      <ul className="space-y-1.5">
        {tasks.map((t) => {
          const ueberfaellig = !t.done && t.due_at < heute
          return (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={t.done}
                disabled={pending}
                onChange={(e) =>
                  start(async () => {
                    await togglePromoTask(t.id, eventId, e.target.checked)
                    router.refresh()
                  })
                }
              />
              <span className={t.done ? "text-zinc-600 line-through" : "text-zinc-200"}>
                {t.title}
              </span>
              <span
                className={`ml-auto shrink-0 text-xs ${
                  ueberfaellig ? "font-medium text-red-400" : "text-zinc-500"
                }`}
              >
                {new Date(t.due_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                {ueberfaellig && " · überfällig"}
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
