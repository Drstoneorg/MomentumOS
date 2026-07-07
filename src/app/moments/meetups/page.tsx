import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui"
import { MEETUP_STATUS_LABELS } from "@/lib/database.types"
import { NewMeetupButton } from "./NewMeetupButton"

export const dynamic = "force-dynamic"

export default async function MeetupsPage() {
  const supabase = await createClient()
  const [meetupsRes, contactsRes] = await Promise.all([
    supabase.from("meetups").select("*, meetup_participants(contacts(name))").order("created_at", { ascending: false }),
    supabase.from("contacts").select("id, name").order("name"),
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Meetups</h1>
        <NewMeetupButton contacts={contactsRes.data ?? []} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(meetupsRes.data ?? []).map((m) => {
          const names = (m.meetup_participants ?? []).map((p) => p.contacts?.name).filter(Boolean)
          return (
            <Link key={m.id} href={`/moments/meetups/${m.id}`}>
              <Card>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-white">{m.title}</h2>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                    {MEETUP_STATUS_LABELS[m.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">{names.join(", ") || "keine Teilnehmer"}</p>
              </Card>
            </Link>
          )
        })}
        {!meetupsRes.data?.length && <p className="text-zinc-500">Noch keine Meetups.</p>}
      </div>
    </div>
  )
}
