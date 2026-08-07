"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { inviteWaveWithDrafts, nudgeUnanswered } from "@/lib/momentsActions"
import { Avatar } from "@/components/Avatar"
import { RSVP_LABELS } from "@/lib/dbLabels"
import { Card, btnCls, btnGhostCls, inputCls } from "@/components/ui"

export type Kandidat = {
  id: string
  name: string
  realm: string
  avatar_url: string | null
  score: number
  gruende: string[]
}

export type Eingeladen = {
  id: string
  contact_id: string
  name: string
  status: string
  wave: number
  plus_ones: number
  rsvp_token: string
  created_at: string
  last_nudge_at: string | null
}

/**
 * Einladungs-Assistent: Kandidaten nach Passung sortiert (Score erklärt sich
 * über Grund-Chips), Auswahl per Checkbox, Welle wählen, ein Klick lädt ein
 * und legt optional personalisierte Entwürfe mit RSVP-Link in die Queue.
 * Gesendet wird nie automatisch.
 */
export function InviteAssistant({
  eventId,
  kandidaten,
  eingeladen,
  nachfassFaellig,
}: {
  eventId: string
  kandidaten: Kandidat[]
  eingeladen: Eingeladen[]
  nachfassFaellig: number
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [suche, setSuche] = useState("")
  const [welle, setWelle] = useState(1)
  const [mitEntwuerfen, setMitEntwuerfen] = useState(true)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [kopiert, setKopiert] = useState<string | null>(null)

  const sichtbar = useMemo(() => {
    const n = suche.trim().toLowerCase()
    return n ? kandidaten.filter((k) => k.name.toLowerCase().includes(n)) : kandidaten
  }, [kandidaten, suche])

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function einladen() {
    start(async () => {
      setMeldung(null)
      try {
        const res = await inviteWaveWithDrafts(eventId, [...sel], welle, mitEntwuerfen)
        setMeldung(
          `${res.invited} eingeladen (Welle ${welle})` +
            (res.drafts ? `, ${res.drafts} Entwürfe in der Queue` : "")
        )
        setSel(new Set())
        router.refresh()
      } catch (e) {
        setMeldung(e instanceof Error ? e.message : "Einladen fehlgeschlagen")
      }
    })
  }

  async function linkKopieren(token: string, inviteId: string) {
    try {
      await navigator.clipboard.writeText(`${location.origin}/einladung/${token}`)
      setKopiert(inviteId)
      setTimeout(() => setKopiert(null), 1500)
    } catch {
      setMeldung("Kopieren nicht möglich, Link von Hand öffnen")
    }
  }

  return (
    <div className="space-y-4">
      <Card title={`Kandidaten nach Passung (${sichtbar.length})`}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="🔍 Name…"
            className={inputCls + " max-w-45"}
          />
          <button
            className={btnGhostCls}
            onClick={() => setSel(new Set(sichtbar.slice(0, 10).map((k) => k.id)))}
          >
            Top 10 wählen
          </button>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5 text-zinc-400">
              Welle
              <select
                value={welle}
                onChange={(e) => setWelle(Number(e.target.value))}
                className={inputCls + " w-auto"}
              >
                <option value={1}>1 · engster Kreis</option>
                <option value={2}>2 · erweitert</option>
                <option value={3}>3 · alle</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-zinc-400" title="Personalisierte Nachricht mit persönlichem RSVP-Link als Entwurf in die Queue">
              <input
                type="checkbox"
                checked={mitEntwuerfen}
                onChange={(e) => setMitEntwuerfen(e.target.checked)}
              />
              Entwürfe in Queue
            </label>
            <button className={btnCls} disabled={pending || sel.size === 0} onClick={einladen}>
              {pending ? "…" : `Einladen (${sel.size})`}
            </button>
          </div>
        </div>

        {meldung && <p className="mb-2 text-sm text-emerald-400">{meldung}</p>}

        <div className="max-h-105 space-y-1 overflow-y-auto pr-1">
          {sichtbar.map((k) => (
            <label
              key={k.id}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-1.5 ${
                sel.has(k.id) ? "border-amber-700 bg-amber-950/20" : "border-zinc-800 hover:border-zinc-600"
              }`}
            >
              <input type="checkbox" checked={sel.has(k.id)} onChange={() => toggle(k.id)} />
              <Avatar name={k.name} url={k.avatar_url} size="sm" />
              <span className="text-sm font-medium text-white">{k.name}</span>
              <span className="flex flex-wrap gap-1">
                {k.gruende.map((g) => (
                  <span
                    key={g}
                    className={`rounded px-1.5 py-px text-[10px] ${
                      g.includes("nie reagiert")
                        ? "bg-red-950/60 text-red-300"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {g}
                  </span>
                ))}
              </span>
              <span className="ml-auto text-xs font-medium tabular-nums text-zinc-500">{k.score}</span>
            </label>
          ))}
          {sichtbar.length === 0 && (
            <p className="py-4 text-center text-sm text-zinc-500">Niemand mehr übrig — alle eingeladen 🖤</p>
          )}
        </div>
      </Card>

      <Card title={`Schon eingeladen (${eingeladen.length})`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">
            Persönlicher RSVP-Link je Gast — kopieren und in irgendeinem Kanal verschicken
          </p>
          <button
            className={btnGhostCls}
            disabled={pending || nachfassFaellig === 0}
            title="Für alle, die seit 3+ Tagen nicht geantwortet haben, einen Reminder-Entwurf in die Queue legen"
            onClick={() =>
              start(async () => {
                const res = await nudgeUnanswered(eventId)
                setMeldung(
                  res.drafts
                    ? `${res.drafts} Nachfass-Entwürfe in der Queue`
                    : "Gerade niemand fällig"
                )
                router.refresh()
              })
            }
          >
            🔔 Nachfassen ({nachfassFaellig})
          </button>
        </div>
        <div className="space-y-1">
          {eingeladen.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-sm">
              <Link href={`/contacts/${i.contact_id}`} className="font-medium text-white hover:underline">
                {i.name}
              </Link>
              <span className="text-xs text-zinc-500">W{i.wave}</span>
              <span className="text-xs text-zinc-400">{RSVP_LABELS[i.status as keyof typeof RSVP_LABELS] ?? i.status}</span>
              {i.plus_ones > 0 && <span className="text-xs text-fuchsia-300">+{i.plus_ones}</span>}
              <button
                onClick={() => linkKopieren(i.rsvp_token, i.id)}
                className="ml-auto rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                {kopiert === i.id ? "✓ kopiert" : "🔗 RSVP-Link"}
              </button>
            </div>
          ))}
          {eingeladen.length === 0 && <p className="py-2 text-sm text-zinc-500">Noch niemand eingeladen</p>}
        </div>
      </Card>
    </div>
  )
}
