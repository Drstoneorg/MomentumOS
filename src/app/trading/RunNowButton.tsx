"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

/** Manueller Tageslauf — nützlich zum Testen und wenn der Cron mal hängt. */
export function RunNowButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")

  async function run() {
    setBusy(true)
    setMsg("KI liest News und wählt Picks …")
    try {
      const res = await fetch("/api/cron/trading", { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Fehler")
      setMsg(json.skipped ? `⏸ ${json.skipped}` : "✓ Tageslauf fertig")
      router.refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Fehler")
    } finally {
      setBusy(false)
      setTimeout(() => setMsg(""), 6000)
    }
  }

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg border border-violet-700 px-3 py-1.5 text-sm font-medium text-violet-300 hover:bg-violet-950 disabled:opacity-50"
      >
        {busy ? "…" : "▶ Tageslauf jetzt"}
      </button>
      {msg && <span className="text-xs text-zinc-400">{msg}</span>}
    </span>
  )
}
