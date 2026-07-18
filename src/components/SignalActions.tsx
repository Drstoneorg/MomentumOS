"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { snoozeSignal, jobLetterPackage } from "@/lib/signalActions"
import { generateGigInquiry } from "@/lib/artistActions"
import type { Signal } from "@/lib/signals"

/**
 * Kontextaktion + Snooze direkt am Signal: erledigen ohne Seitenwechsel.
 * Welche Aktion passt, entscheidet das Signal selbst (gigId/jobId/…).
 */
export function SignalActions({ signal }: { signal: Signal }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [note, setNote] = useState<string | null>(null)
  const [variants, setVariants] = useState<Record<string, string> | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  function snooze(days: number) {
    start(async () => {
      const res = await snoozeSignal(signal.key, days)
      setNote(res.error ?? null)
      router.refresh()
    })
  }

  function gigReminder() {
    if (!signal.gigId) return
    start(async () => {
      const res = await generateGigInquiry(
        signal.gigId!,
        "Freundliche Erinnerung: unsere Anfrage ist noch offen — kurz nachhaken"
      )
      setNote(res.error ? res.error : "✓ Erinnerungs-Entwurf am Gig gespeichert")
      router.refresh()
    })
  }

  function jobPackage() {
    if (!signal.jobId) return
    start(async () => {
      const res = await jobLetterPackage(signal.jobId!)
      if (res.error) {
        setNote(res.error)
        return
      }
      if (res.letter && res.email) {
        window.location.href = `mailto:${res.email}?subject=${encodeURIComponent(
          res.subject ?? "Bewerbung"
        )}&body=${encodeURIComponent(res.letter)}`
        setNote("✓ Anschreiben bereit — Mailprogramm geöffnet")
      } else {
        setNote("✓ Anschreiben generiert — Empfänger-Mail fehlt, unter /jobs senden")
      }
      router.refresh()
    })
  }

  function checkin() {
    if (!signal.contactId) return
    start(async () => {
      try {
        const res = await fetch("/api/moments/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: signal.contactId, kind: "checkin" }),
        })
        const data = (await res.json()) as { variants?: Record<string, string>; error?: string }
        if (!res.ok || !data.variants) {
          setNote(data.error ?? "Entwurf fehlgeschlagen")
          return
        }
        setVariants(data.variants)
      } catch {
        setNote("Netzwerkfehler")
      }
    })
  }

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {signal.gigId && (
          <button onClick={gigReminder} disabled={pending} className={actionCls}>
            ⏰ Erinnerung entwerfen
          </button>
        )}
        {signal.jobId && (
          <button onClick={jobPackage} disabled={pending} className={actionCls}>
            {signal.jobHasLetter ? "✉️ Bewerbungs-Mail öffnen" : "📝 Anschreiben + Mail"}
          </button>
        )}
        {signal.checkin && !variants && (
          <button onClick={checkin} disabled={pending} className={actionCls}>
            💬 Check-in-Entwurf
          </button>
        )}
        {signal.dateId && (
          <a href={`/api/dates/${signal.dateId}/ics`} className={actionCls}>
            📅 .ics
          </a>
        )}
        <span className="text-[10px] text-zinc-600">💤</span>
        <button onClick={() => snooze(1)} disabled={pending} className={snoozeCls} title="Bis morgen ausblenden">
          1d
        </button>
        <button onClick={() => snooze(7)} disabled={pending} className={snoozeCls} title="Eine Woche ausblenden">
          7d
        </button>
        {pending && <span className="text-xs text-zinc-500">…</span>}
      </div>
      {note && <p className="text-xs text-zinc-400">{note}</p>}
      {variants && (
        <div className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
          {Object.entries(variants).map(([style, text]) => (
            <div key={style} className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-xs text-zinc-300">
                <span className="font-semibold uppercase text-amber-400">{style}</span> {text}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(text)
                  setCopied(style)
                  setTimeout(() => setCopied(null), 1500)
                }}
                className="shrink-0 text-xs text-zinc-500 hover:text-white"
              >
                {copied === style ? "✓" : "Kopieren"}
              </button>
            </div>
          ))}
          <p className="text-[10px] text-zinc-600">
            Entwurf — kopieren und selbst senden. Auch gespeichert auf der{" "}
            <Link href={signal.href} className="underline">
              Kontaktseite
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}

const actionCls =
  "rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
const snoozeCls =
  "rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
