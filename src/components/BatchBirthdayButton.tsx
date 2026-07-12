"use client"

import { useState } from "react"

/**
 * Ein Klick: Gruß-Entwürfe (Text + Bild) für alle Geburtstage der nächsten
 * 7 Tage vorbereiten. Landet als Entwurf in der Queue — gesendet wird manuell.
 */
export function BatchBirthdayButton({ count }: { count: number }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/moments/batch-birthdays", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setResult(data.error ?? "Fehler")
      } else {
        const skipped = (data.results ?? []).filter((r: { status: string }) =>
          r.status.includes("übersprungen")
        ).length
        setResult(
          `${data.created} vorbereitet${skipped ? `, ${skipped} schon fertig` : ""}${
            data.stoppedEarly ? " — Zeitlimit, nochmal klicken für den Rest" : ""
          } → Queue`
        )
      }
    } catch {
      setResult("Netzwerkfehler")
    }
    setLoading(false)
  }

  if (!count) return null
  return (
    <div className="space-y-1">
      <button
        onClick={run}
        disabled={loading}
        className="rounded-lg border border-amber-700 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-950 disabled:opacity-50"
      >
        {loading ? "Generiere… (kann 1-2 Min dauern)" : `🎂 Alle ${count} Grüße jetzt vorbereiten`}
      </button>
      {result && <p className="text-xs text-zinc-400">{result}</p>}
    </div>
  )
}
