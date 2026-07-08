import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { BookingLive } from "./BookingLive"

export const dynamic = "force-dynamic"

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, treatments(name), providers(name, rating_avg, rating_count, bio)")
    .eq("id", id)
    .maybeSingle()
  if (!booking) notFound()

  const [{ data: geoRows }, { data: review }] = await Promise.all([
    supabase.rpc("booking_geo", { p_booking: id }),
    supabase.from("reviews").select("id").eq("booking_id", id).maybeSingle(),
  ])
  const geo = Array.isArray(geoRows) && geoRows[0] ? geoRows[0] : null

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/book/bookings" className="text-sm text-zinc-400 hover:underline">
        ← Meine Buchungen
      </Link>
      <h1 className="text-xl font-bold">Buchung</h1>
      <BookingLive
        booking={booking}
        treatmentName={booking.treatments?.name ?? "Treatment"}
        provider={booking.providers ?? null}
        geo={geo}
        hasReview={!!review}
      />
    </div>
  )
}
