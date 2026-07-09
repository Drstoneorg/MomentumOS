"use client"

import { useState } from "react"
import type { ReplyVariants } from "@/lib/ai/generateReplies"

/**
 * Ein-Klick-Antwort direkt vom Dashboard: generiert Varianten mit
 * Auto-Situation aus dem letzten Verlauf, zeigt sie inline mit Copy.
 */
export function QuickReply({ contactId }: { contactId: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ReplyVariants | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function generate() {
    if (result) return setOpen(!open)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          situation: "Antworte passend auf die letzte Nachricht der Person.",
          channel: "manual",
          nowLocal: new Date().toString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Fehler")
      setResult(data)
      setOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler")
    } finally {
      setLoading(false)
    }
  }

  async function copy(style: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(style)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="inline-block w-full">
      <button
        onClick={generate}
        disabled={loading}
        title="Antwortvorschläge sofort generieren"
        className="rounded border border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300 hover:bg-zinc-800"
      >
        {loading ? "…" : result ? (open ? "⚡ zu" : "⚡ zeigen") : "⚡ Antwort"}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      {open && result && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950 p-2">
          {result.next_step && (
            <p className="text-xs text-zinc-500">
              <span className="text-zinc-300">Empfehlung:</span> {result.next_step}
            </p>
          )}
          {Object.entries(result.variants).map(([style, text]) => (
            <div key={style} className="flex items-start gap-2">
              <div className="flex-1">
                <span className="text-[10px] font-semibold uppercase text-rose-400">{style}</span>
                <p className="text-xs text-zinc-200">{text}</p>
              </div>
              <button
                onClick={() => copy(style, text)}
                className="shrink-0 rounded border border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                {copied === style ? "✓" : "Kopieren"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
