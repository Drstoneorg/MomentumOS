import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui"
import { BookingForm } from "./BookingForm"

export const dynamic = "force-dynamic"

export default async function BookPage() {
  const supabase = await createClient()
  const [{ data: treatments }, { data: active }] = await Promise.all([
    supabase.from("treatments").select("*").eq("active", true).order("sort"),
    supabase
      .from("bookings")
      .select("id, status")
      .in("status", ["requested", "accepted", "en_route", "arrived", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Treatment buchen</h1>
        <Link href="/book/bookings" className="text-sm text-sky-400 hover:underline">
          Meine Buchungen →
        </Link>
      </div>

      {active && (
        <Link
          href={`/book/bookings/${active.id}`}
          className="block rounded-xl border border-sky-800 bg-sky-950/30 p-3 text-sm text-sky-300 hover:bg-sky-950/50"
        >
          ⚡ Du hast eine laufende Buchung — Live-Status ansehen →
        </Link>
      )}

      <Card title="Neue Buchung">
        {treatments?.length ? (
          <BookingForm treatments={treatments} />
        ) : (
          <p className="text-sm text-zinc-500">Kein Treatment-Katalog vorhanden.</p>
        )}
      </Card>
    </div>
  )
}
