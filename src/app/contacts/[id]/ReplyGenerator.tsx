"use client"

import { useState } from "react"
import type { ReplyVariants } from "@/lib/ai/generateReplies"
import { Card, inputCls, btnCls, btnGhostCls } from "@/components/ui"

export function ReplyGenerator({
  contactId,
  language,
}: {
  contactId: string
  language: string
}) {
  const [situation, setSituation] = useState("")
  const [channel, setChannel] = useState("manual")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<(ReplyVariants & { suggestionId?: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    const res = await fetch("/api/ai/replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, situation, channel }),
    })
    setLoading(false)
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Fehler")
      return
    }
    setResult(data)
  }

  async function copy(style: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(style)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <Card title="Antwortgenerator">
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="Situation (optional): z.B. 'sie hat nach meinem Wochenende gefragt' oder 'Date vorschlagen'"
            className={inputCls}
          />
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls + " w-auto"}>
            <option value="manual">Copy-Paste</option>
            <option value="telegram">Telegram (Queue)</option>
          </select>
          <button onClick={generate} disabled={loading} className={btnCls + " whitespace-nowrap"}>
            {loading ? "Generiere…" : "Generieren"}
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}

        {result && (
          <div className="space-y-2">
            <div className="rounded-lg bg-zinc-950 p-3 text-sm">
              <p className="text-zinc-400">
                <span className="font-medium text-zinc-200">Lage:</span> {result.social_read}
              </p>
              <p className="mt-1 text-zinc-400">
                <span className="font-medium text-zinc-200">Empfehlung:</span>{" "}
                {result.next_step} — {result.next_step_reason}
              </p>
            </div>

            {Object.entries(result.variants).map(([style, text]) => (
              <div key={style} className="flex items-start gap-2 rounded-lg border border-zinc-800 p-3">
                <div className="flex-1">
                  <span className="text-xs font-semibold uppercase text-rose-400">{style}</span>
                  <p className="mt-1 text-sm text-zinc-200">{text}</p>
                </div>
                <button onClick={() => copy(style, text)} className={btnGhostCls + " shrink-0"}>
                  {copied === style ? "✓" : "Kopieren"}
                </button>
              </div>
            ))}

            {result.cjk && (
              <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 text-sm">
                <p className="font-medium text-amber-200">{result.cjk.original}</p>
                <p className="mt-1 text-zinc-300">Übersetzung: {result.cjk.translation}</p>
                <p className="text-zinc-400">Lesung: {result.cjk.reading}</p>
                <p className="text-zinc-400">Ton: {result.cjk.tone}</p>
                <p className="mt-1 text-amber-300/80">⚠ {result.cjk.culture_note}</p>
              </div>
            )}

            {channel === "telegram" && result.suggestionId && (
              <p className="text-xs text-zinc-500">
                Als Entwurf in der Queue gespeichert — dort Variante wählen und freigeben.
              </p>
            )}
          </div>
        )}
        {language !== "de" && language !== "en" && !result && (
          <p className="text-xs text-zinc-500">
            Sprache „{language}“: Generator liefert Original + Übersetzung + Umschrift + Kultur-Hinweis.
          </p>
        )}
      </div>
    </Card>
  )
}
