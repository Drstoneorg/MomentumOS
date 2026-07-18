"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateSuggestion } from "@/lib/actions"
import { QueueItem } from "./QueueItem"
import type { Tables } from "@/lib/database.types"

type Item = {
  suggestion: Tables<"suggestions">
  contactName: string
  channels: { channel: string; handle: string }[]
}

/**
 * Batch-Freigabe: Stapel per Tastatur durchgehen — j/k (oder ↓/↑) springen,
 * Enter gibt den markierten Entwurf frei, x verwirft ihn. Jede Freigabe bleibt
 * ein bewusster Tastendruck pro Entwurf — nur eben ohne Maus und Scrollen.
 */
export function QueueBatch({ items }: { items: Item[] }) {
  const router = useRouter()
  const [focus, setFocus] = useState(0)
  const [pending, start] = useTransition()
  const refs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    refs.current[focus]?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [focus])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault()
        setFocus((f) => Math.min(f + 1, items.length - 1))
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault()
        setFocus((f) => Math.max(f - 1, 0))
      } else if (e.key === "Enter" || e.key === "x") {
        const item = items[focus]
        if (!item || item.suggestion.status !== "draft" || pending) return
        e.preventDefault()
        const discard = e.key === "x"
        const variants = (item.suggestion.variants ?? {}) as Record<string, string>
        const chosen = item.suggestion.chosen_variant ?? Object.keys(variants)[0]
        if (!discard && !chosen) return
        start(async () => {
          await updateSuggestion(
            item.suggestion.id,
            discard ? { status: "discarded" } : { status: "approved", chosen_variant: chosen }
          )
          router.refresh()
        })
        setFocus((f) => Math.min(f + 1, items.length - 1))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [items, focus, pending, router])

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-zinc-500">
        Queue leer. Auf einer Personenseite Antworten mit Kanal „Telegram" generieren.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-[11px] text-zinc-500">
        ⌨️ Durchgeh-Modus: <kbd className={kbd}>j</kbd>/<kbd className={kbd}>k</kbd> springen ·{" "}
        <kbd className={kbd}>Enter</kbd> freigeben · <kbd className={kbd}>x</kbd> verwerfen — die
        gewählte Variante zählt
      </p>
      {items.map((it, i) => (
        <div
          key={it.suggestion.id}
          ref={(el) => {
            refs.current[i] = el
          }}
          onClick={() => setFocus(i)}
          className={`rounded-xl transition-shadow ${
            i === focus ? "ring-2 ring-rose-600/70" : ""
          }`}
        >
          <QueueItem
            suggestion={it.suggestion}
            contactName={it.contactName}
            channels={it.channels}
          />
        </div>
      ))}
    </div>
  )
}

const kbd = "rounded border border-zinc-700 bg-zinc-800 px-1 text-[10px] text-zinc-300"
