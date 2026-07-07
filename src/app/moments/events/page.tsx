import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui"
import { NewEventButton } from "./NewEventButton"

export const dynamic = "force-dynamic"

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: events } = await supabase
    .from("events")
    .select("*, event_invites(status)")
    .order("starts_at", { ascending: true, nullsFirst: false })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Events</h1>
        <NewEventButton />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(events ?? []).map((e) => {
          const invites = e.event_invites ?? []
          const yes = invites.filter((i) => i.status === "yes").length
          return (
            <Link key={e.id} href={`/moments/events/${e.id}`}>
              <Card>
                <h2 className="font-semibold text-white">{e.title}</h2>
                <p className="text-sm text-zinc-400">
                  {e.starts_at ? new Date(e.starts_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : "Datum offen"}
                  {e.location ? ` · ${e.location}` : ""}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {invites.length} eingeladen · {yes} zugesagt
                  {e.capacity ? ` · Kapazität ${e.capacity}` : ""}
                </p>
              </Card>
            </Link>
          )
        })}
        {!events?.length && <p className="text-zinc-500">Noch keine Events.</p>}
      </div>
    </div>
  )
}
