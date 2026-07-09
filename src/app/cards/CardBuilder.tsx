"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { btnCls } from "@/components/ui"
import { CardSend } from "./CardSend"

type Fact = { id: string; label: string; value: string; source: string }
type Channel = { channel: string; handle: string; is_primary?: boolean }
type CardDetails = {
  title: string
  type_line: string
  element: string
  rarity: string
  attack: number
  defense: number
  effect: string
  flavor: string
}

export function CardBuilder({
  contacts,
  templates,
}: {
  contacts: { id: string; name: string }[]
  templates: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [contactId, setContactId] = useState("")
  const [facts, setFacts] = useState<Fact[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [templateId, setTemplateId] = useState("")
  const [wishes, setWishes] = useState("")
  const [withImage, setWithImage] = useState(true)
  const [loading, setLoading] = useState(false)
  const [factsLoading, setFactsLoading] = useState(false)
  const [error, setError] = useState("")
  const [channels, setChannels] = useState<Channel[]>([])
  const [contactName, setContactName] = useState("")
  const [result, setResult] = useState<{ details: CardDetails; imageUrl: string | null; assetId: string | null } | null>(null)

  async function loadFacts(id: string) {
    setContactId(id)
    setFacts([])
    setResult(null)
    setError("")
    if (!id) return
    setFactsLoading(true)
    try {
      const res = await fetch(`/api/cards/facts?contactId=${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Fehler")
      setFacts(data.facts)
      setChannels(data.channels ?? [])
      setContactName(data.name ?? "")
      setSelected(new Set((data.facts as Fact[]).map((f) => f.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden")
    } finally {
      setFactsLoading(false)
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function generate() {
    setLoading(true)
    setError("")
    setResult(null)
    try {
      const res = await fetch("/api/cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          factIds: [...selected],
          templateId: templateId || undefined,
          wishes: wishes.trim() || undefined,
          withImage,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Fehler")
      setResult({ details: data.details, imageUrl: data.imageUrl, assetId: data.assetId ?? null })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Karten-Fehler")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="font-semibold text-white">Karte erstellen</h2>

      <div className="flex flex-wrap gap-2">
        <select
          value={contactId}
          onChange={(e) => loadFacts(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200"
        >
          <option value="">Kontakt wählen…</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200"
        >
          <option value="">Ohne Vorlage (KI gestaltet frei)</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>Vorlage: {t.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-zinc-300">
          <input type="checkbox" checked={withImage} onChange={(e) => setWithImage(e.target.checked)} />
          Bild generieren (kostet)
        </label>
      </div>

      {factsLoading && <p className="text-sm text-zinc-500">Lade freigegebene Fakten…</p>}

      {facts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-zinc-500">
            Diese Infos hat der Privacy-Filter freigegeben — abwählen, was nicht auf die Karte soll:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {facts.map((f) => (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  selected.has(f.id)
                    ? "border-rose-600 bg-rose-950/40 text-rose-200"
                    : "border-zinc-700 text-zinc-500"
                }`}
              >
                {f.label}: {f.value}
              </button>
            ))}
          </div>
        </div>
      )}

      {contactId && !factsLoading && facts.length === 0 && !error && (
        <p className="text-sm text-zinc-500">
          Keine freigegebenen Fakten — Interessen oder Gedächtnis-Einträge (Mag/Thema) beim Kontakt pflegen.
        </p>
      )}

      <input
        value={wishes}
        onChange={(e) => setWishes(e.target.value)}
        placeholder="Optional: Wünsche (z. B. Element Feuer, Drachen-Motiv, legendär)"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200"
      />

      <button onClick={generate} disabled={!contactId || loading} className={btnCls}>
        {loading ? "Erzeuge Karte…" : "Karte erzeugen"}
      </button>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            {result.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.imageUrl} alt={result.details.title} className="w-64 rounded-lg border border-zinc-700" />
            )}
            <div className="min-w-64 flex-1 space-y-1 text-sm">
              <p className="text-base font-bold text-white">{result.details.title}</p>
              <p className="text-zinc-400">{result.details.type_line} · {result.details.element} · {result.details.rarity}</p>
              <p className="text-zinc-200">⚔ {result.details.attack} / 🛡 {result.details.defense}</p>
              <p className="text-zinc-300">{result.details.effect}</p>
              <p className="italic text-zinc-500">{result.details.flavor}</p>
            </div>
          </div>

          <CardSend
            contactId={contactId}
            assetId={result.assetId}
            imageUrl={result.imageUrl}
            channels={channels}
            defaultText={`${contactName ? contactName + ", hier" : "Hier"} deine ganz persönliche Karte 🃏 ${result.details.title}`}
          />
        </div>
      )}
    </div>
  )
}
