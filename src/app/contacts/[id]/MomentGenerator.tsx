"use client"

import { useState } from "react"
import { Card, inputCls, btnCls, btnGhostCls } from "@/components/ui"
import { logAssetSend } from "@/lib/momentsActions"

const SEND_CHANNELS = ["WhatsApp", "Telegram", "Signal", "Instagram", "E-Mail", "Anderes"]

const KINDS = [
  { id: "birthday", label: "Geburtstagsgruß" },
  { id: "checkin", label: "Check-in" },
  { id: "recap", label: "Jahresrückblick" },
]
const IMG_STYLES = ["Anime", "Aquarell", "3D Render", "Retro-Poster", "Fotorealistisch", "Cartoon"]

// Kostenschätzung gpt-image-2 (Bild-Output-Tokens × $30/1M), nur für UI-Hinweis.
const IMG_COST: Record<string, Record<"low" | "medium" | "high", number>> = {
  square: { low: 0.006, medium: 0.053, high: 0.211 },
  portrait: { low: 0.009, medium: 0.041, high: 0.165 },
  story: { low: 0.009, medium: 0.041, high: 0.165 },
  landscape: { low: 0.009, medium: 0.041, high: 0.165 },
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
  const [quality, setQuality] = useState<"low" | "medium">("low")
  const [customPrompt, setCustomPrompt] = useState("")
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [assetId, setAssetId] = useState<string | null>(null)
  const [sentVia, setSentVia] = useState<string[]>([])

  // Änderung der Bild-Eingaben verwirft einen zuvor generierten Prompt, damit
  // "Bild erzeugen" nicht mit einem veralteten Prompt malt.
  function invalidatePrompt() {
    setImgResult(null)
  }
  const [imgOccasion, setImgOccasion] = useState("Geburtstag")
  const [imgResult, setImgResult] = useState<{ prompt: string; negative_prompt: string; caption: string } | null>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgLoading, setImgLoading] = useState(false)

  async function copy(k: string, t: string) {
    await navigator.clipboard.writeText(t)
    setCopied(k)
    setTimeout(() => setCopied(null), 1500)
  }

  // Direktversand: native Share-Sheet des Geräts (Handy/PWA → WhatsApp, Telegram,
  // Signal, Mail …). Teilt das echte Bild als Datei, sonst URL, sonst kopiert URL.
  async function shareImage() {
    if (!imgUrl) return
    const caption = imgResult?.caption ?? ""
    try {
      const blob = await (await fetch(imgUrl)).blob()
      const file = new File([blob], "momentumos-bild.png", { type: blob.type || "image/png" })
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: caption })
        return
      }
      if (navigator.share) {
        await navigator.share({ url: imgUrl, text: caption })
        return
      }
      await navigator.clipboard.writeText(imgUrl)
      setShareMsg("Teilen nicht unterstützt — Bild-URL kopiert.")
      setTimeout(() => setShareMsg(null), 2500)
    } catch {
      // Nutzer hat abgebrochen o.ä. — still ignorieren
    }
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
        // Eigener Prompt gewinnt; sonst zuvor generierter; sonst baut die Route ihn aus den Details.
        prompt: customPrompt.trim() || imgResult?.prompt || undefined,
      }),
    })
    setImgLoading(false)
    const data = await res.json()
    if (!res.ok) return setError(data.error ?? "Fehler")
    setImgUrl(data.url)
    setAssetId(data.assetId ?? null)
    setSentVia([])
  }

  // Versand notieren: hält im Bild-Archiv fest, an wen/über welchen Kanal gesendet wurde.
  async function markSent(channel: string) {
    if (!assetId || sentVia.includes(channel)) return
    setSentVia((v) => [...v, channel])
    try {
      await logAssetSend({ assetId, contactId, channel })
    } catch {
      setSentVia((v) => v.filter((c) => c !== channel))
    }
  }

  return (
    <Card title="MomentOS-Generator">
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
            <input value={imgOccasion} onChange={(e) => { setImgOccasion(e.target.value); invalidatePrompt() }} placeholder="Anlass" className={inputCls + " w-auto"} />
            <select value={style} onChange={(e) => { setStyle(e.target.value); invalidatePrompt() }} className={inputCls + " w-auto"}>
              {IMG_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={format} onChange={(e) => { setFormat(e.target.value); invalidatePrompt() }} className={inputCls + " w-auto"}>
              <option value="portrait">Portrait 4:5</option>
              <option value="square">Quadrat 1:1</option>
              <option value="story">Story 9:16</option>
              <option value="landscape">Quer 16:9</option>
            </select>
            <select value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)} className={inputCls + " w-auto"}>
              <option value="low">Qualität niedrig</option>
              <option value="medium">Qualität mittel</option>
            </select>
            <button onClick={genImage} disabled={loading} className={btnGhostCls}>{loading ? "…" : "Prompt"}</button>
            <button onClick={genRealImage} disabled={imgLoading} className={btnCls}>
              {imgLoading
                ? "Erzeuge…"
                : `Bild erzeugen (~${(() => {
                    const ct = (IMG_COST[format]?.[quality] ?? 0.2) * 100
                    return ct < 1 ? "<1" : ct.toFixed(0)
                  })()} ct)`}
            </button>
          </div>
          <div className={"space-y-1 " + (customPrompt.trim() ? "opacity-40" : "")}>
            <label className="text-xs font-semibold text-zinc-300">
              Vibe / Details <span className="font-normal text-zinc-500">— Stichworte, KI baut den Prompt</span>
            </label>
            <input
              value={context}
              onChange={(e) => { setContext(e.target.value); invalidatePrompt() }}
              placeholder="z. B. warme Farben, Konfetti, Sonnenuntergang, verspielt"
              className={inputCls}
              disabled={!!customPrompt.trim()}
            />
            <p className="text-xs text-zinc-600">
              Nur Stimmung/Farben/Objekte — keine echten Namen, kein Körper-/Romantik-Wording (blockt OpenAI).
            </p>
          </div>

          <div className="space-y-1 border-t border-zinc-800 pt-2">
            <label className="text-xs font-semibold text-zinc-300">
              Eigener Prompt <span className="font-normal text-zinc-500">— optional, für Profis</span>
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={2}
              placeholder="Kompletten Bild-Text selbst schreiben (Englisch am besten). Wird 1:1 an die KI geschickt."
              className={inputCls}
            />
            <p className="text-xs text-zinc-600">
              {customPrompt.trim() ? (
                <span className="text-amber-400">
                  Aktiv — „Bild erzeugen&quot; nutzt genau diesen Text. Anlass/Stil/Vibe oben werden ignoriert.
                </span>
              ) : (
                "Leer lassen, wenn du oben mit Anlass + Vibe arbeitest. Gefüllt = überschreibt alles darüber."
              )}
            </p>
          </div>
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
                „Bild erzeugen&quot; malt direkt (braucht OPENAI_API_KEY). Alternativ Prompt in Midjourney/DALL-E nutzen.
              </p>
            </div>
          )}
          {imgUrl && (
            <div className="space-y-2 rounded-lg border border-zinc-800 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt="Generiertes Bild" className="max-h-80 w-full rounded-lg object-contain" />
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={shareImage} className={btnCls}>📤 Teilen / Senden</button>
                <button onClick={() => copy("imgurl", imgUrl)} className={btnGhostCls}>
                  {copied === "imgurl" ? "✓ kopiert" : "Bild-URL kopieren"}
                </button>
                <a href={imgUrl} target="_blank" rel="noreferrer" className="text-xs text-rose-400 hover:underline">Bild öffnen ↗</a>
              </div>
              {shareMsg && <p className="text-xs text-amber-400">{shareMsg}</p>}
              <p className="text-xs text-zinc-600">
                „Teilen&quot; öffnet auf dem Handy die App-Auswahl (WhatsApp, Telegram, Signal, Mail …) mit dem Bild als Datei. Am Desktop: „Bild-URL kopieren&quot; und im Chat einfügen.
              </p>
              {assetId && (
                <div className="border-t border-zinc-800 pt-2">
                  <p className="mb-1 text-xs text-zinc-500">Gesendet über (fürs Archiv notieren):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SEND_CHANNELS.map((ch) => (
                      <button
                        key={ch}
                        onClick={() => markSent(ch)}
                        disabled={sentVia.includes(ch)}
                        className={
                          "rounded-full border px-2.5 py-1 text-xs " +
                          (sentVia.includes(ch)
                            ? "border-emerald-600 bg-emerald-950 text-emerald-300"
                            : "border-zinc-700 text-zinc-300 hover:bg-zinc-800")
                        }
                      >
                        {sentVia.includes(ch) ? `✓ ${ch}` : ch}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
