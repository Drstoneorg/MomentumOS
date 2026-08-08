/**
 * Konflikt-Wächter: Terminkollisionen zwischen Events und doppelt verplante
 * Artists am selben Tag. Reine Prüfung, blockiert nichts — nur Warnbanner.
 */

function wienTag(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna", dateStyle: "short" }).format(d)
}

export type KonfliktEvent = { id: string; title: string; starts_at: string | null }
export type KonfliktGig = {
  event_id: string | null
  artistName: string
  /** Datum des Events, an dem der Gig hängt */
  starts_at: string | null
}

/**
 * Warnungen für EIN Event: andere Events am selben Kalendertag und Artists
 * dieses Events, die am selben Tag woanders spielen.
 */
export function eventKonflikte(
  event: KonfliktEvent,
  andereEvents: KonfliktEvent[],
  eigeneArtistIds: string[],
  fremdeGigs: (KonfliktGig & { artist_id: string; eventTitle: string })[]
): string[] {
  const tag = wienTag(event.starts_at)
  if (!tag) return []
  const warnungen: string[] = []

  for (const e of andereEvents) {
    if (e.id === event.id) continue
    if (wienTag(e.starts_at) === tag) {
      warnungen.push(`Terminkollision: „${e.title}" liegt am selben Tag`)
    }
  }

  const eigene = new Set(eigeneArtistIds)
  const gemeldet = new Set<string>()
  for (const g of fremdeGigs) {
    if (g.event_id === event.id) continue
    if (!eigene.has(g.artist_id)) continue
    if (wienTag(g.starts_at) !== tag) continue
    const key = `${g.artist_id}:${g.event_id}`
    if (gemeldet.has(key)) continue
    gemeldet.add(key)
    warnungen.push(`${g.artistName} spielt am selben Tag bei „${g.eventTitle}"`)
  }

  return warnungen
}
