import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MeetupDetail } from "./MeetupDetail"
import { MeetupAnnounce } from "./MeetupAnnounce"

export const dynamic = "force-dynamic"

export default async function MeetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [meetupRes, partsRes] = await Promise.all([
    supabase.from("meetups").select("*").eq("id", id).single(),
    supabase
      .from("meetup_participants")
      .select("*, contacts(name, language, contact_channels(channel, handle, is_primary))")
      .eq("meetup_id", id),
  ])
  if (!meetupRes.data) notFound()

  const meetup = meetupRes.data
  const participants = partsRes.data ?? []
  return (
    <div className="space-y-4">
      <MeetupDetail meetup={meetup} participants={participants} />
      <MeetupAnnounce
        meetupId={meetup.id}
        title={meetup.title}
        slots={meetup.slots}
        chosenSlot={meetup.chosen_slot}
        participants={participants}
      />
    </div>
  )
}
