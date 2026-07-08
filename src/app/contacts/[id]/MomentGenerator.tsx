"use client"

import { useState } from "react"
import { Card, inputCls, btnCls, btnGhostCls } from "@/components/ui"

const KINDS = [
  { id: "birthday", label: "Geburtstagsgruß" },
  { id: "checkin", label: "Check-in" },
  { id: "recap", label: "Jahresrückblick" },
]
const IMG_STYLES = ["Anime", "Aquarell", "3D Render", "Retro-Poster", "Fotorealistisch", "Cartoon"]

// Kostenschätzung gpt-image-1 (Bild-Output-Tokens × $40/1M), nur für UI-Hinweis.
const IMG_COST: Record<string, Record<"low" | "medium" | "high", number>> = {
  square: { low: 0.01, medium: 0.04, high: 0.17 },
  portrait: { low: 0.02, medium: 0.06, high: 0.25 },
  story: { low: 0.02, medium: 0.06, high: 0.25 },
  landscape: { low: 0.02, medium: 0.06, high: 0.25 },
}

export function MomentGenerator({ contactId }: { contactId: string }) {
  const [tab, setTab] = useState<"text" | "image">("text")
  const [kind, setKind] = useState("birthday")
  const [context, setContext] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Record<string, string> | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [style, setStyle] = useState("Anime")
  const [format, setFormat] = useState("portrait")
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium")
  const [imgOccasion, setImgOccasion] = useState("Geburtstag")
  const [imgResult, setImgResult] = useState<{ prompt: string; negative_prompt: string; caption: string } | null>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgLoading, setImgLoading] = useState(false)

  async function copy(k: string, t: string) {
    await navigator.clipboard.writeText(t)
    setCopied(k)
    setTimeout(() => setCopied(null), 1500)
  }

  async function genText() {
    setLoading(true); setError(null); setMsgs(null)
    const res = await fetch("/api/moments/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, kind, context }),
    })
    setLoading(false)
    const data = await res.json()
    if (!res.ok) return setError(data.error ?? "Fehler")
    setMsgs(data.variants)
  }

  async function genImage() {
    setLoading(true); setError(null); setImgResult(null)
    const res = await fetch("/api/moments/image-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, occasion: imgOccasion, name: "", style, details: context, format }),
    })
    setLoading(false)
    const data = await res.json()
    if (!res.ok) return setError(data.error ?? "Fehler")
    setImgResult(data)
  }

  async function genRealImage() {
    setImgLoading(true); setError(null); setImgUrl(null)
    const res = await fetch("/api/moments/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId, occasion: imgOccasion, name: "", style, details: context, format, quality,
        prompt: imgResult?.prompt,
      }),
    })
    setImgLoading(false)
    const data = await res.json()
    if (!res.ok) return setError(data.error ?? "Fehler")
    setImgUrl(data.url)
  }

  return (
    <Card title="Moments-Generator">
      <div className="mb-3 flex gap-2">
        <button onClick={() => setTab("text")} className={tab === "text" ? btnCls : btnGhostCls}>Nachricht</button>
        <button onClick={() => setTab("image")} className={tab === "image" ? btnCls : btnGhostCls}>Bild-Prompt</button>
      </div>

      {tab === "text" ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls + " w-auto"}>
              {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
            <input value={context} onChange={(e) => setContext(e.target.value)} placeholder="Kontext (optional)" className={inputCls} />
            <button onClick={genText} disabled={loading} className={btnCls + " whitespace-nowrap"}>
              {loading ? "…" : "Generieren"}
            </button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {msgs && Object.entries(msgs).map(([s, t]) => (
            <div key={s} className="flex items-start gap-2 rounded-lg border border-zinc-800 p-3">
              <div className="flex-1">
                <span className="text-xs font-semibold uppercase text-rose-400">{s}</span>
                <p className="mt-1 text-sm text-zinc-200">{t}</p>
              </div>
              <button onClick={() => copy(s, t)} className={btnGhostCls + " shrink-0"}>{copied === s ? "✓" : "Kopieren"}</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input value={imgOccasion} onChange={(e) => setImgOccasion(e.target.value)} placeholder="Anlass" className={inputCls + " w-auto"} />
            <select value={style} onChange={(e) => setStyle(e.target.value)} className={inputCls + " w-auto"}>
              {IMG_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputCls + " w-auto"}>
              <option value="portrait">Portrait 4:5</option>
              <option value="square">Quadrat 1:1</option>
              <option value="story">Story 9:16</option>
              <option value="landscape">Quer 16:9</option>
            </select>
            <select value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)} className={inputCls + " w-auto"}>
              <option value="low">Qualität niedrig</option>
              <option value="medium">Qualität mittel</option>
              <option value="high">Qualität hoch</option>
            </select>
            <button onClick={genImage} disabled={loading} className={btnGhostCls}>{loading ? "…" : "Prompt"}</button>
            <button onClick={genRealImage} disabled={imgLoading} className={btnCls}>
              {imgLoading ? "Male…" : `Bild erzeugen (~${((IMG_COST[format]?.[quality] ?? 0.25) * 100).toFixed(0)} ct)`}
            </button>
          </div>
          <input value={context} onChange={(e) => setContext(e.target.value)} placeholder="Vibe/Farben/Details" className={inputCls} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {imgResult && (
            <div className="space-y-2 rounded-lg border border-zinc-800 p-3 text-sm">
              <div>
                <span className="text-xs font-semibold uppercase text-rose-400">Prompt</span>
                <p className="mt-1 text-zinc-200">{imgResult.prompt}</p>
                <button onClick={() => copy("prompt", imgResult.prompt)} className={btnGhostCls + " mt-1"}>
                  {copied === "prompt" ? "✓" : "Prompt kopieren"}
                </button>
              </div>
              <p className="text-zinc-500"><b>Negativ:</b> {imgResult.negative_prompt}</p>
              <p className="text-zinc-400"><b>Caption:</b> {imgResult.caption}</p>
              <p className="text-xs text-zinc-600">
                „Bild erzeugen" malt direkt (braucht OPENAI_API_KEY). Alternativ Prompt in Midjourney/DALL-E nutzen.
              </p>
            </div>
          )}
          {imgUrl && (
            <div className="space-y-1 rounded-lg border border-zinc-800 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt="Generiertes Bild" className="max-h-80 w-full rounded-lg object-contain" />
              <a href={imgUrl} target="_blank" rel="noreferrer" className="text-xs text-rose-400 hover:underline">Bild öffnen ↗</a>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
