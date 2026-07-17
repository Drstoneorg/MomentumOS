import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ArtistDetail } from "./ArtistDetail"

export const dynamic = "force-dynamic"

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: artist }, { data: gigs }, { data: events }] = await Promise.all([
    supabase.from("artists").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("gigs")
      .select("*, events(title, starts_at, location)")
      .eq("artist_id", id)
      .order("gig_date", { ascending: false, nullsFirst: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("id, title, starts_at")
      .order("starts_at", { ascending: false, nullsFirst: false })
      .limit(30),
  ])
  if (!artist) notFound()

  return (
    <div className="space-y-4">
      <Link href="/book/artists" className="text-sm text-sky-400 hover:underline">
        ← Artist-Booking
      </Link>
      <ArtistDetail artist={artist} gigs={gigs ?? []} events={events ?? []} />
    </div>
  )
}
