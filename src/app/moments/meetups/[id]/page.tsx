import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MeetupDetail } from "./MeetupDetail"

export const dynamic = "force-dynamic"

export default async function MeetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [meetupRes, partsRes] = await Promise.all([
    supabase.from("meetups").select("*").eq("id", id).single(),
    supabase.from("meetup_participants").select("*, contacts(name)").eq("meetup_id", id),
  ])
  if (!meetupRes.data) notFound()

  return <MeetupDetail meetup={meetupRes.data} participants={partsRes.data ?? []} />
}
