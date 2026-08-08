"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { cloneEvent, updateEvent } from "@/lib/momentsActions"
import { InlineField } from "@/components/InlineField"

/**
 * Event-Werkzeuge im Kopfbereich: Klonen (mit neu terminiertem Promo-Fahrplan
 * und Gästelisten-Vorschlag), Serienname und öffentlicher Slug für /e/[slug].
 */
export function EventTools({
  eventId,
  seriesName,
  publicSlug,
}: {
  eventId: string
  seriesName: string | null
  publicSlug: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [meldung, setMeldung] = useState<string | null>(null)
  const [kopiert, setKopiert] = useState(false)

  function klonen() {
    start(async () => {
      try {
        const neuId = await cloneEvent(eventId)
        router.push(`/moments/events/${neuId}`)
      } catch (e) {
        setMeldung(e instanceof Error ? e.message : "Klonen fehlgeschlagen")
      }
    })
  }

  const slugSauber = (v: string) =>
    v
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)

  return (
    <div className="mt-3 space-y-1.5 text-xs text-zinc-400">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          Serie:{" "}
          <InlineField
            value={seriesName ?? ""}
            placeholder="z. B. Goth Night"
            onSave={(v) => updateEvent(eventId, { series_name: v.trim() || null })}
          />
        </span>
        <span>
          Öffentlicher Link:{" "}
          <InlineField
            value={publicSlug ?? ""}
            placeholder="slug setzen"
            onSave={(v) => updateEvent(eventId, { public_slug: slugSauber(v) || null })}
          />
        </span>
        {publicSlug && (
          <button
            className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:bg-zinc-800"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${location.origin}/e/${publicSlug}`)
                setKopiert(true)
                setTimeout(() => setKopiert(false), 1500)
              } catch {
                setMeldung(`Link: /e/${publicSlug}`)
              }
            }}
          >
            {kopiert ? "✓ kopiert" : `🔗 /e/${publicSlug}`}
          </button>
        )}
        <button
          className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:bg-zinc-800"
          disabled={pending}
          title="Kopie mit neuem Datum (+28 Tage), Promo-Fahrplan und Gästelisten-Vorschlag aus diesem Event"
          onClick={klonen}
        >
          {pending ? "…" : "🧬 Event klonen"}
        </button>
      </div>
      {publicSlug && (
        <p className="text-zinc-600">
          /e/{publicSlug} ist ohne Login erreichbar (für Insta-Bio) — Interessenten landen als Lead in der Gästeliste
        </p>
      )}
      {meldung && <p className="text-red-400">{meldung}</p>}
    </div>
  )
}
