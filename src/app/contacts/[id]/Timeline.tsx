"use client"

import { useState } from "react"
import { Card } from "@/components/ui"

export type TimelineItem = {
  at: string
  kind: "message_in" | "message_out" | "memory" | "followup" | "date" | "meetup" | "event" | "checkin"
  title: string
  detail?: string | null
}

const KIND_META: Record<TimelineItem["kind"], { icon: string; label: string }> = {
  message_in: { icon: "💬", label: "Nachricht erhalten" },
  message_out: { icon: "📤", label: "Nachricht gesendet" },
  memory: { icon: "🧠", label: "Gedächtnis" },
  followup: { icon: "⏰", label: "Follow-up" },
  date: { icon: "❤️", label: "Date" },
  meetup: { icon: "🤝", label: "Meetup" },
  event: { icon: "🎉", label: "Event" },
  checkin: { icon: "✅", label: "Check-in" },
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? items : items.slice(0, 12)

  return (
    <Card title={`Aktivitäts-Timeline (${items.length})`}>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Noch keine Aktivität.</p>
      ) : (
        <ol className="relative space-y-3 border-l border-zinc-800 pl-4">
          {shown.map((it, i) => {
            const meta = KIND_META[it.kind]
            return (
              <li key={i} className="relative">
                <span className="absolute -left-[1.35rem] top-0.5 text-xs">{meta.icon}</span>
                <p className="text-xs text-zinc-500">
                  {new Date(it.at).toLocaleString("de-DE", {
                    day: "2-digit", month: "2-digit", year: "2-digit",
                    hour: "2-digit", minute: "2-digit",
                  })}{" "}
                  · {meta.label}
                </p>
                <p className="text-sm text-zinc-200">{it.title}</p>
                {it.detail && <p className="text-xs text-zinc-400">{it.detail}</p>}
              </li>
            )
          })}
        </ol>
      )}
      {items.length > 12 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-rose-400 hover:underline"
        >
          {expanded ? "Weniger anzeigen" : `Alle ${items.length} anzeigen`}
        </button>
      )}
    </Card>
  )
}
