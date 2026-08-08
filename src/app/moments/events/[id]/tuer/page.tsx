import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DoorList } from "./DoorList"

export const dynamic = "force-dynamic"

/** Tür-Modus: Zusagen + Tickets + schon Eingecheckte als Abhak-Liste am Einlass. */
export default async function TuerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: event }, { data: invites }] = await Promise.all([
    supabase.from("events").select("id, title, starts_at, door_token").eq("id", id).maybeSingle(),
    supabase
      .from("event_invites")
      .select(
        "id, contact_id, status, plus_ones, promo_code, rsvp_token, companion_names, contacts(name, avatar_url)"
      )
      .eq("event_id", id)
      .in("status", ["yes", "ticket", "attended"]),
  ])
  if (!event) notFound()

  const gaeste = (invites ?? [])
    .filter((i) => i.contacts)
    .map((i) => ({
      inviteId: i.id,
      contactId: i.contact_id,
      name: i.contacts!.name,
      avatar_url: i.contacts!.avatar_url,
      status: i.status,
      plus_ones: i.plus_ones ?? 0,
      promo_code: i.promo_code,
      rsvp_token: i.rsvp_token,
      companion_names: i.companion_names,
    }))

  return (
    <div className="mx-auto max-w-md space-y-3">
      <div>
        <Link href={`/moments/events/${id}`} className="text-sm text-amber-400 hover:underline">
          ← {event.title}
        </Link>
        <h1 className="mt-1 text-xl font-bold">🚪 Tür</h1>
      </div>
      <DoorList eventId={id} gaeste={gaeste} doorToken={event.door_token} />
    </div>
  )
}
