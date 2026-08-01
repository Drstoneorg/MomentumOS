"use client"

import { useState, useTransition } from "react"
import { regenerateCalendarToken } from "./calendarActions"
import { btnGhostCls } from "@/components/ui"

export function CalendarFeedForm({ currentToken }: { currentToken: string }) {
  const [token, setToken] = useState(currentToken)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const httpsUrl = token ? `${origin}/api/calendar?token=${token}` : null
  const webcalUrl = httpsUrl?.replace(/^https?:/, "webcal:") ?? null

  function regenerate() {
    setError(null)
    start(async () => {
      const res = await regenerateCalendarToken()
      if (res.error) setError(res.error)
      else if (res.token) setToken(res.token)
    })
  }

  async function copy(url: string, label: string) {
    await navigator.clipboard.writeText(url)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="space-y-2 text-sm">
      {httpsUrl ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-400">
              {httpsUrl}
            </code>
            <button onClick={() => copy(httpsUrl, "https")} className={btnGhostCls}>
              {copied === "https" ? "✔ Kopiert" : "Kopieren"}
            </button>
            {webcalUrl && (
              <a href={webcalUrl} className={btnGhostCls} title="Öffnet die Kalender-App mit Abo-Dialog">
                📅 Abonnieren
              </a>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            iPhone/Mac: „Abonnieren“ tippen. Google Kalender: Einstellungen → Kalender hinzufügen →
            Per URL — die kopierte Adresse einfügen. Wer die Adresse hat, sieht die Termine —
            bei Bedarf unten erneuern, dann gilt nur noch die neue.
          </p>
        </>
      ) : (
        <p className="text-zinc-500">Noch keine Feed-Adresse — unten erzeugen.</p>
      )}
      <button onClick={regenerate} disabled={pending} className={btnGhostCls}>
        {pending ? "…" : token ? "🔄 Adresse erneuern (alte wird ungültig)" : "Feed-Adresse erzeugen"}
      </button>
      {error && <p className="text-rose-400">{error}</p>}
    </div>
  )
}
