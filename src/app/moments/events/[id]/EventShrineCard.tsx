"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  publishToShrine,
  unpublishFromShrine,
  saveEventTicketUrl,
  setShrinePublishProfile,
} from "@/lib/shrineActions"
import { Card, btnCls, inputCls } from "@/components/ui"

type Profil = { id: string; username: string; display_name: string | null }

/**
 * Shrine-Schaufenster: dieses Event als öffentliche Veranstaltung auf Shrine
 * stellen (Eventkalender der eigenen Social-Plattform). MomentumOS bleibt die
 * Quelle — erneut veröffentlichen überträgt Änderungen, Entfernen löscht drüben.
 */
export function EventShrineCard({
  eventId,
  konfiguriert,
  profile,
  gewaehltesProfil,
  shrinePublishedAt,
  ticketUrl,
  hatDatum,
}: {
  eventId: string
  konfiguriert: boolean
  profile: Profil[]
  gewaehltesProfil: string
  shrinePublishedAt: string | null
  ticketUrl: string | null
  hatDatum: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  const [ticket, setTicket] = useState(ticketUrl ?? "")

  if (!konfiguriert) {
    return (
      <Card title="🕯 Shrine-Schaufenster">
        <p className="text-sm text-zinc-400">
          Noch nicht verbunden: In Vercel fehlt <span className="text-zinc-200">SHRINE_SERVICE_ROLE_KEY</span>{" "}
          (Service-Key des Shrine-Projekts, Dashboard → Settings → API). Sobald er da ist, lässt sich
          dieses Event per Klick als öffentliche Veranstaltung in den Shrine-Eventkalender stellen —
          samt Ticket-Link.
        </p>
      </Card>
    )
  }

  const lauf = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setFehler(null)
      const res = await fn()
      if (res.error) setFehler(res.error)
      router.refresh()
    })

  return (
    <Card title="🕯 Shrine-Schaufenster">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-zinc-500">
          Veröffentlichen als
          <select
            className={inputCls + " mt-1"}
            value={gewaehltesProfil}
            onChange={(e) =>
              start(async () => {
                await setShrinePublishProfile(e.target.value)
                router.refresh()
              })
            }
          >
            <option value="">— Profil wählen —</option>
            {profile.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name || p.username} (@{p.username})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-500">
          Ticket-Link (Pretix, RA, Eventbrite …)
          <input
            className={inputCls + " mt-1"}
            value={ticket}
            placeholder="https://…"
            onChange={(e) => setTicket(e.target.value)}
            onBlur={() => start(() => saveEventTicketUrl(eventId, ticket))}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className={btnCls}
          disabled={pending || !hatDatum}
          onClick={() => lauf(() => publishToShrine(eventId))}
          title={hatDatum ? undefined : "Event braucht erst ein Datum"}
        >
          {pending ? "…" : shrinePublishedAt ? "Änderungen erneut veröffentlichen" : "Auf Shrine veröffentlichen"}
        </button>
        {shrinePublishedAt && (
          <>
            <span className="text-xs text-emerald-400">
              ✓ öffentlich seit{" "}
              {new Date(shrinePublishedAt).toLocaleString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <button
              className="text-xs text-zinc-500 underline-offset-2 hover:text-red-400 hover:underline"
              disabled={pending}
              onClick={() => {
                if (confirm("Event von Shrine entfernen? Der öffentliche Eintrag wird gelöscht.")) {
                  lauf(() => unpublishFromShrine(eventId))
                }
              }}
            >
              von Shrine entfernen
            </button>
          </>
        )}
      </div>
      {fehler && <p className="mt-2 text-xs text-red-400">{fehler}</p>}
      <p className="mt-2 text-xs text-zinc-600">
        Überträgt Titel, Beschreibung, Ort, Datum und Ticket-Link. Nichts geht automatisch raus —
        jede Übertragung ist dieser Klick.
      </p>
    </Card>
  )
}
