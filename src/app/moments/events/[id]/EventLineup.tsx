import Link from "next/link"
import type { Enums } from "@/lib/database.types"
import { GIG_STATUS_COLOR, GIG_STATUS_LABELS, parseSetSlot, slotsOverlap } from "@/lib/artists"
import { Card } from "@/components/ui"

type LineupGig = {
  id: string
  artist_id: string
  artistName: string
  set_slot: string | null
  status: Enums<"gig_status">
}

/**
 * Lineup des Abends: Gigs nach Set-Slot sortiert, Überschneidungen markiert.
 * Slots pflegt man am Gig auf der Artist-Seite.
 */
export function EventLineup({ gigs }: { gigs: LineupGig[] }) {
  const active = gigs.filter((g) => g.status !== "cancelled")
  if (active.length < 2) return null

  const parsed = active.map((g) => ({ gig: g, slot: parseSetSlot(g.set_slot) }))
  const sorted = [...parsed].sort((a, b) => {
    if (!a.slot && !b.slot) return 0
    if (!a.slot) return 1
    if (!b.slot) return -1
    return a.slot.start - b.slot.start
  })
  // Konflikt-Erkennung über alle Slot-Paare
  const conflictIds = new Set<string>()
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i]
      const b = parsed[j]
      if (a.slot && b.slot && slotsOverlap(a.slot, b.slot)) {
        conflictIds.add(a.gig.id)
        conflictIds.add(b.gig.id)
      }
    }
  }

  return (
    <Card title="🎛 Lineup">
      <ul className="space-y-1.5 text-sm">
        {sorted.map(({ gig, slot }) => (
          <li key={gig.id} className="flex items-center gap-2">
            <span className="w-24 shrink-0 font-mono text-xs text-zinc-400">
              {gig.set_slot ?? "Slot offen"}
            </span>
            <Link href={`/book/artists/${gig.artist_id}`} className="font-medium text-white hover:underline">
              {gig.artistName}
            </Link>
            <span className={`rounded-full px-2 py-0.5 text-xs ${GIG_STATUS_COLOR[gig.status]}`}>
              {GIG_STATUS_LABELS[gig.status]}
            </span>
            {conflictIds.has(gig.id) && (
              <span className="text-xs text-rose-400" title="Slot überschneidet sich mit einem anderen Act">
                ⚠ Überschneidung
              </span>
            )}
            {!slot && gig.set_slot && (
              <span className="text-xs text-zinc-600" title="Slot nicht lesbar — Format z.B. 23–01">
                (nicht lesbar)
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
