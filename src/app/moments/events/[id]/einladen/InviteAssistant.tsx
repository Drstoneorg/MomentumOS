"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  acceptWaveProposal,
  bestaetigeChatVermutung,
  deleteGuestSegment,
  dismissWaveProposal,
  inviteWaveWithDrafts,
  nudgeUnanswered,
  saveGuestSegment,
} from "@/lib/momentsActions"
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
  sendezeit: string | null
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
  companion_names: string | null
  comment: string | null
  suggested_status: string | null
  suggested_quote: string | null
}

export type Segment = { id: string; name: string; contact_ids: string[] }
export type WellenVorschlag = { id: string; wave: number; reason: string | null; namen: string[] }
export type MixZeile = { gruppe: string; label: string; n: number; anteil: number }

/**
 * Einladungs-Assistent: Kandidaten nach Passung sortiert (Score erklärt sich
 * über Grund-Chips), Auswahl per Checkbox, Welle wählen, ein Klick lädt ein
 * und legt optional personalisierte Entwürfe mit RSVP-Link in die Queue.
 * Segmente speichern Auswahl-Listen, der Wächter schlägt Wellen vor,
 * Chat-Zusagen-Vermutungen werden per Klick bestätigt. Gesendet wird nie
 * automatisch.
 */
export function InviteAssistant({
  eventId,
  kandidaten,
  eingeladen,
  nachfassFaellig,
  segmente,
  wellenVorschlag,
  mix,
}: {
  eventId: string
  kandidaten: Kandidat[]
  eingeladen: Eingeladen[]
  nachfassFaellig: number
  segmente: Segment[]
  wellenVorschlag: WellenVorschlag | null
  mix: MixZeile[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [suche, setSuche] = useState("")
  const [welle, setWelle] = useState(1)
  const [mitEntwuerfen, setMitEntwuerfen] = useState(true)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [kopiert, setKopiert] = useState<string | null>(null)
  const [segmentName, setSegmentName] = useState("")
  const [segmentSpeichern, setSegmentSpeichern] = useState(false)

  const sichtbar = useMemo(() => {
    const n = suche.trim().toLowerCase()
    return n ? kandidaten.filter((k) => k.name.toLowerCase().includes(n)) : kandidaten
  }, [kandidaten, suche])

  const vermutungen = eingeladen.filter((i) => i.suggested_status)

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function segmentLaden(seg: Segment) {
    const kandidatenIds = new Set(kandidaten.map((k) => k.id))
    const treffer = seg.contact_ids.filter((id) => kandidatenIds.has(id))
    setSel(new Set(treffer))
    setMeldung(
      `Segment „${seg.name}": ${treffer.length} von ${seg.contact_ids.length} wählbar (Rest schon eingeladen oder weg)`
    )
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
      {wellenVorschlag && (
        <div className="rounded-xl border border-amber-700/60 bg-amber-950/20 p-3">
          <p className="text-sm font-medium text-amber-200">
            🤖 Wächter schlägt Welle {wellenVorschlag.wave} vor
            {wellenVorschlag.reason ? ` — ${wellenVorschlag.reason}` : ""}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {wellenVorschlag.namen.join(", ")}
            {wellenVorschlag.namen.length >= 12 ? " …" : ""}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              className={btnCls}
              disabled={pending || wellenVorschlag.namen.length === 0}
              onClick={() =>
                start(async () => {
                  try {
                    const res = await acceptWaveProposal(wellenVorschlag.id)
                    setMeldung(`${res.invited} eingeladen, ${res.drafts} Entwürfe in der Queue`)
                    router.refresh()
                  } catch (e) {
                    setMeldung(e instanceof Error ? e.message : "Übernehmen fehlgeschlagen")
                  }
                })
              }
            >
              Übernehmen + Entwürfe
            </button>
            <button
              className={btnGhostCls}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await dismissWaveProposal(wellenVorschlag.id)
                  router.refresh()
                })
              }
            >
              Verwerfen
            </button>
          </div>
        </div>
      )}

      {vermutungen.length > 0 && (
        <div className="rounded-xl border border-sky-800/60 bg-sky-950/20 p-3">
          <p className="text-sm font-medium text-sky-200">
            💬 Aus dem Chat erkannt — bestätigen oder verwerfen
          </p>
          <div className="mt-2 space-y-1.5">
            {vermutungen.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-white">{i.name}</span>
                <span
                  className={`rounded px-1.5 py-px text-xs ${
                    i.suggested_status === "yes"
                      ? "bg-emerald-950/60 text-emerald-300"
                      : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  klingt nach {i.suggested_status === "yes" ? "Zusage" : "Absage"}
                </span>
                {i.suggested_quote && (
                  <span className="text-xs text-zinc-500">„{i.suggested_quote}&quot;</span>
                )}
                <span className="ml-auto flex gap-1">
                  <button
                    className="rounded border border-emerald-700 px-2 py-0.5 text-xs text-emerald-300 hover:bg-emerald-950/40"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await bestaetigeChatVermutung(i.id, eventId, true)
                        router.refresh()
                      })
                    }
                  >
                    ✓ Übernehmen
                  </button>
                  <button
                    className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await bestaetigeChatVermutung(i.id, eventId, false)
                        router.refresh()
                      })
                    }
                  >
                    ✕
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
          {segmente.length > 0 && (
            <select
              className={inputCls + " w-auto"}
              value=""
              onChange={(e) => {
                const seg = segmente.find((s) => s.id === e.target.value)
                if (seg) segmentLaden(seg)
              }}
              title="Gespeichertes Segment in die Auswahl laden"
            >
              <option value="">📁 Segment…</option>
              {segmente.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.contact_ids.length})
                </option>
              ))}
            </select>
          )}
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

        {sel.size > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            {segmentSpeichern ? (
              <>
                <input
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                  placeholder="Segment-Name, z. B. Goth Wien"
                  className={inputCls + " max-w-55"}
                  maxLength={60}
                />
                <button
                  className={btnGhostCls}
                  disabled={pending || !segmentName.trim()}
                  onClick={() =>
                    start(async () => {
                      try {
                        await saveGuestSegment(segmentName, [...sel])
                        setMeldung(`Segment „${segmentName.trim()}" gespeichert (${sel.size} Kontakte)`)
                        setSegmentName("")
                        setSegmentSpeichern(false)
                        router.refresh()
                      } catch (e) {
                        setMeldung(e instanceof Error ? e.message : "Speichern fehlgeschlagen")
                      }
                    })
                  }
                >
                  Speichern
                </button>
                <button className={btnGhostCls} onClick={() => setSegmentSpeichern(false)}>
                  Abbrechen
                </button>
              </>
            ) : (
              <button className={btnGhostCls} onClick={() => setSegmentSpeichern(true)}>
                💾 Auswahl als Segment speichern ({sel.size})
              </button>
            )}
          </div>
        )}

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
                      g.includes("nie reagiert") || g.includes("Feedback nur")
                        ? "bg-red-950/60 text-red-300"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {g}
                  </span>
                ))}
                {k.sendezeit && (
                  <span className="rounded bg-indigo-950/60 px-1.5 py-px text-[10px] text-indigo-300" title="Wann diese Person erfahrungsgemäß antwortet">
                    🕑 {k.sendezeit}
                  </span>
                )}
              </span>
              <span className="ml-auto text-xs font-medium tabular-nums text-zinc-500">{k.score}</span>
            </label>
          ))}
          {sichtbar.length === 0 && (
            <p className="py-4 text-center text-sm text-zinc-500">Niemand mehr übrig — alle eingeladen 🖤</p>
          )}
        </div>

        {segmente.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-zinc-800/60 pt-2">
            {segmente.map((s) => (
              <span key={s.id} className="flex items-center gap-1 rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-400">
                📁 {s.name}
                <button
                  className="text-zinc-600 hover:text-red-400"
                  title="Segment löschen (Kontakte bleiben)"
                  onClick={() =>
                    start(async () => {
                      await deleteGuestSegment(s.id)
                      router.refresh()
                    })
                  }
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </Card>

      {mix.length > 0 && (
        <Card title="🧭 Gäste-Mix der Zusagen">
          <div className="space-y-1">
            {mix.map((z) => (
              <div key={`${z.gruppe}-${z.label}`} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 truncate text-zinc-400">{z.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded bg-zinc-900">
                  <span
                    className={`block h-full rounded ${z.gruppe === "Stadt" ? "bg-fuchsia-700" : "bg-sky-700"}`}
                    style={{ width: `${Math.max(3, Math.round(z.anteil * 100))}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right tabular-nums text-zinc-300">{z.n}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-600">
            Nur Zusagen — zeigt früh, welche Stadt oder welcher Kreis schwächelt
          </p>
        </Card>
      )}

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
              {i.plus_ones > 0 && (
                <span className="text-xs text-fuchsia-300" title={i.companion_names ?? undefined}>
                  +{i.plus_ones}
                  {i.companion_names ? ` (${i.companion_names})` : ""}
                </span>
              )}
              {i.comment && (
                <span className="text-xs text-zinc-500" title={i.comment}>
                  💬 „{i.comment.slice(0, 40)}{i.comment.length > 40 ? "…" : ""}&quot;
                </span>
              )}
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
