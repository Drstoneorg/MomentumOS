import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui"
import { daysUntilBirthday, connectionScore, scoreColor } from "@/lib/moments"

export const dynamic = "force-dynamic"

export default async function MomentsHub() {
  const supabase = await createClient()
  const [contactsRes, eventsRes, meetupsRes, assetsRes] = await Promise.all([
    supabase.from("contacts").select("*").neq("pipeline_stage", "archived"),
    supabase.from("events").select("id, title, starts_at").order("starts_at", { nullsFirst: false }).limit(5),
    supabase.from("meetups").select("id, title, status").not("status", "in", "(happened,cancelled)").limit(5),
    supabase.from("moment_assets").select("*").order("created_at", { ascending: false }).limit(8),
  ])

  const contacts = contactsRes.data ?? []

  const birthdays = contacts
    .map((c) => ({ c, d: daysUntilBirthday(c.birthday) }))
    .filter((x) => x.d != null && x.d <= 30)
    .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))

  const neglected = contacts
    .map((c) => ({ c, ...connectionScore(c) }))
    .filter((x) => x.overdue && (x.c.relationship_tags?.length ?? 0) > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Moments</h1>
        <div className="ml-auto flex gap-2">
          <Link href="/moments/events" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">Events</Link>
          <Link href="/moments/meetups" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">Meetups</Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title={`Anstehende Geburtstage (${birthdays.length})`}>
          <ul className="space-y-2 text-sm">
            {birthdays.map(({ c, d }) => (
              <li key={c.id} className="flex items-center gap-2">
                <Link href={`/contacts/${c.id}`} className="font-medium text-white hover:underline">{c.name}</Link>
                <span className={d === 0 ? "text-rose-400" : "text-zinc-400"}>
                  {d === 0 ? "heute 🎂" : `in ${d}d`}
                </span>
              </li>
            ))}
            {!birthdays.length && <li className="text-zinc-500">Keine in den nächsten 30 Tagen.</li>}
          </ul>
        </Card>

        <Card title={`Vernachlässigte Kontakte (${neglected.length})`}>
          <ul className="space-y-2 text-sm">
            {neglected.map(({ c, score, daysSince }) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${scoreColor(score)}`} />
                <Link href={`/contacts/${c.id}`} className="font-medium text-white hover:underline">{c.name}</Link>
                <span className="ml-auto text-xs text-zinc-500">{daysSince == null ? "nie" : `${daysSince}d`}</span>
              </li>
            ))}
            {!neglected.length && <li className="text-zinc-500">Alle gepflegt. 👌</li>}
          </ul>
        </Card>

        <Card title="Offene Meetups">
          <ul className="space-y-2 text-sm">
            {(meetupsRes.data ?? []).map((m) => (
              <li key={m.id}><Link href={`/moments/meetups/${m.id}`} className="text-white hover:underline">{m.title}</Link> <span className="text-xs text-zinc-500">{m.status}</span></li>
            ))}
            {!meetupsRes.data?.length && <li className="text-zinc-500">Keine offenen Meetups.</li>}
          </ul>
        </Card>

        <Card title="Events">
          <ul className="space-y-2 text-sm">
            {(eventsRes.data ?? []).map((e) => (
              <li key={e.id}><Link href={`/moments/events/${e.id}`} className="text-white hover:underline">{e.title}</Link>{e.starts_at ? <span className="text-xs text-zinc-500"> · {new Date(e.starts_at).toLocaleDateString("de-DE")}</span> : null}</li>
            ))}
            {!eventsRes.data?.length && <li className="text-zinc-500">Keine Events.</li>}
          </ul>
        </Card>

        <Card title="Asset Library" className="md:col-span-2">
          <ul className="grid gap-2 sm:grid-cols-2">
            {(assetsRes.data ?? []).map((a) => (
              <li key={a.id} className="rounded-lg border border-zinc-800 p-2 text-sm">
                <span className="text-xs font-semibold uppercase text-rose-400">{a.kind}</span>
                {a.title && <span className="ml-2 text-zinc-400">{a.title}</span>}
                <p className="mt-1 line-clamp-2 text-zinc-300">{a.content}</p>
              </li>
            ))}
            {!assetsRes.data?.length && <li className="text-zinc-500">Noch keine Assets — über den Moments-Generator auf einer Kontaktseite erzeugen.</li>}
          </ul>
        </Card>
      </div>
    </div>
  )
}
