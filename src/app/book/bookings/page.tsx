import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { BOOKING_STATUS_LABELS } from "@/lib/database.types"
import { formatPrice, totalCents, STATUS_COLOR } from "@/lib/bookos"

export const dynamic = "force-dynamic"

export default async function BookingsPage() {
  const supabase = await createClient()
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, treatments(name), providers(name)")
    .order("created_at", { ascending: false })

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Meine Buchungen</h1>
        <Link href="/book" className="text-sm text-sky-400 hover:underline">+ Neue Buchung</Link>
      </div>

      {!bookings?.length ? (
        <p className="py-8 text-center text-zinc-500">Noch keine Buchungen.</p>
      ) : (
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link
                href={`/book/bookings/${b.id}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 hover:border-zinc-700"
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_COLOR[b.status]}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">
                    {b.treatments?.name ?? "Treatment"}
                    {b.providers?.name ? <span className="text-zinc-500"> · {b.providers.name}</span> : null}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {new Date(b.created_at).toLocaleString("de-DE")} · {b.address}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-zinc-300">{BOOKING_STATUS_LABELS[b.status]}</p>
                  <p className="text-xs text-zinc-500">{formatPrice(totalCents(b.price_cents, b.travel_fee_cents))}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
