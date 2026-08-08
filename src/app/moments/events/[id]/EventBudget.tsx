"use client"

import Link from "next/link"
import type { Enums } from "@/lib/database.types"
import { updateEvent } from "@/lib/momentsActions"
import { GIG_STATUS_LABELS, formatEuro, gigFeeTotals, parseFeeInput } from "@/lib/artists"
import { Card } from "@/components/ui"
import { InlineField } from "@/components/InlineField"

type BudgetGig = {
  id: string
  artist_id: string
  artistName: string
  fee_cents: number | null
  status: Enums<"gig_status">
}

/**
 * Event-Budget: Gagen aus dem Artist-Booking (BookOS-Gigs) gegen
 * Ticketeinnahmen (verkaufte Tickets × Preis) + sonstige Kosten.
 */
export function EventBudget({
  eventId,
  ticketPriceCents,
  otherCostsCents,
  ticketsSold,
  gigs,
}: {
  eventId: string
  ticketPriceCents: number | null
  otherCostsCents: number | null
  ticketsSold: number
  gigs: BudgetGig[]
}) {
  const { fixedCents, pendingCents } = gigFeeTotals(gigs)
  const revenueCents = ticketsSold * (ticketPriceCents ?? 0)
  const costsCents = fixedCents + (otherCostsCents ?? 0)
  const balanceCents = revenueCents - costsCents
  // Break-even: ab wie vielen zahlenden Gästen die Kosten drin sind
  const breakEven =
    ticketPriceCents && costsCents > 0 ? Math.ceil(costsCents / ticketPriceCents) : null

  return (
    <Card title="💰 Budget">
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-zinc-950 p-2">
            <p className="text-xs text-zinc-500">🎟 Tickets ({ticketsSold} ×)</p>
            <InlineField
              value={ticketPriceCents ? formatEuro(ticketPriceCents) : ""}
              placeholder="Preis setzen"
              displayClassName="text-zinc-200"
              onSave={(v) => updateEvent(eventId, { ticket_price_cents: parseFeeInput(v) })}
            />
          </div>
          <div className="rounded-lg bg-zinc-950 p-2">
            <p className="text-xs text-zinc-500">Einnahmen</p>
            <p className="font-semibold text-emerald-300">{formatEuro(revenueCents)}</p>
          </div>
          <div className="rounded-lg bg-zinc-950 p-2">
            <p className="text-xs text-zinc-500">Gagen fix + Kosten</p>
            <p className="font-semibold text-rose-300">{formatEuro(costsCents)}</p>
          </div>
          <div className="rounded-lg bg-zinc-950 p-2">
            <p className="text-xs text-zinc-500">Saldo</p>
            <p className={`font-semibold ${balanceCents >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {formatEuro(balanceCents)}
            </p>
          </div>
        </div>

        {breakEven != null && (
          <p className="text-xs text-zinc-400">
            🎯 Break-even bei <span className="font-semibold text-white">{breakEven}</span> zahlenden
            Gästen — aktuell {ticketsSold}
            {ticketsSold >= breakEven ? " ✓ Kosten drin" : ` (noch ${breakEven - ticketsSold})`}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
          <span>
            Sonstige Kosten (Location, Deko, Promo):{" "}
            <InlineField
              value={otherCostsCents ? formatEuro(otherCostsCents) : ""}
              placeholder="—"
              onSave={(v) => updateEvent(eventId, { other_costs_cents: parseFeeInput(v) })}
            />
          </span>
          {pendingCents > 0 && (
            <span className="text-amber-300">
              ⚠ {formatEuro(pendingCents)} Gagen noch in Verhandlung (nicht im Saldo)
            </span>
          )}
        </div>

        {gigs.length > 0 ? (
          <ul className="space-y-1 text-xs">
            {gigs.map((g) => (
              <li key={g.id} className="flex items-center gap-2">
                <Link href={`/book/artists/${g.artist_id}`} className="text-sky-400 hover:underline">
                  🎧 {g.artistName}
                </Link>
                <span className="text-zinc-500">{GIG_STATUS_LABELS[g.status]}</span>
                <span className="ml-auto text-zinc-300">
                  {g.fee_cents ? formatEuro(g.fee_cents) : "Gage offen"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-zinc-500">
            Noch keine Artists gebucht —{" "}
            <Link href="/book/artists" className="text-sky-400 hover:underline">
              im Artist-Booking
            </Link>{" "}
            einen Gig mit diesem Event verknüpfen
          </p>
        )}
      </div>
    </Card>
  )
}
