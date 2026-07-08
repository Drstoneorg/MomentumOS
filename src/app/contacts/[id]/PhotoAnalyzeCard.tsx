"use client"

import { useRef, useState } from "react"
import { Card, btnCls, inputCls } from "@/components/ui"
import type { PhotoVerdict } from "@/lib/ai/vision"

export function PhotoAnalyzeCard({ available }: { available: boolean }) {
  const [url, setUrl] = useState("")
  const [preview, setPreview] = useState<string | null>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verdict, setVerdict] = useState<PhotoVerdict | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const d = reader.result as string
      setDataUrl(d)
      setPreview(d)
      setUrl("")
    }
    reader.readAsDataURL(file)
  }

  async function analyze() {
    setLoading(true)
    setError(null)
    setVerdict(null)
    try {
      const res = await fetch("/api/vision/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataUrl ? { dataUrl } : { imageUrl: url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Fehler")
      setVerdict(data as PhotoVerdict)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler")
    } finally {
      setLoading(false)
    }
  }

  const color = (s: number) =>
    s >= 70 ? "bg-emerald-500" : s >= 45 ? "bg-amber-500" : "bg-rose-500"

  return (
    <Card title="Foto-Check (Beuteschema)">
      {!available ? (
        <p className="text-sm text-zinc-500">
          Braucht OPENAI_API_KEY. In Vercel setzen → Einstellungen → API-Status.
        </p>
      ) : (
        <div className="space-y-2">
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setDataUrl(null)
              setPreview(e.target.value || null)
            }}
            placeholder="Foto-URL einfügen…"
            className={inputCls}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              📁 Datei wählen
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            <button
              onClick={analyze}
              disabled={loading || (!url.trim() && !dataUrl)}
              className={btnCls + " ml-auto !px-3 !py-1 text-xs"}
            >
              {loading ? "Analysiere…" : "✨ Prüfen"}
            </button>
          </div>

          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Vorschau" className="max-h-40 rounded-lg border border-zinc-800" />
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {verdict && (
            <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${color(verdict.score)}`}>
                  {verdict.score} · {verdict.matches ? "passt" : "eher nicht"}
                </span>
                <span className="text-sm text-zinc-300">{verdict.summary}</span>
              </div>
              {verdict.hits.length > 0 && (
                <p className="text-xs text-emerald-400">✓ {verdict.hits.join(", ")}</p>
              )}
              {verdict.concerns.length > 0 && (
                <p className="text-xs text-rose-400">⚠ {verdict.concerns.join(", ")}</p>
              )}
              {verdict.traits.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {verdict.traits.map((t) => (
                    <span key={t} className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-zinc-600">Nur dein Kriterien-Abgleich. Deine Entscheidung.</p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
