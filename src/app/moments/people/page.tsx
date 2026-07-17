import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ContactsTable } from "@/app/contacts/ContactsTable"
import { Card } from "@/components/ui"
import { connectionScore } from "@/lib/moments"

export const dynamic = "force-dynamic"

/** MomentOS-Kontakte: Freunde und echte Bekannte — getrennt von der Matchbox. */
export default async function MomentsPeoplePage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("realm", "moment")
    .order("updated_at", { ascending: false })

  // Beziehungs-Rhythmus: wer ist relativ zu seinem Frequenzziel überfällig?
  const overdue = (contacts ?? [])
    .map((c) => ({ c, conn: connectionScore(c) }))
    .filter(({ conn }) => conn.overdue)
    .sort((a, b) => b.conn.score - a.conn.score)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Kontakte</h1>
        <p className="text-sm text-zinc-400">
          Deine MomentOS-Kontakte — Menschen, die du wirklich kennst. Matches wohnen in der{" "}
          <Link href="/contacts" className="text-rose-400 hover:underline">Matchbox</Link>.
        </p>
      </div>

      {overdue.length > 0 && (
        <Card title={`🔔 Rhythmus überfällig (${overdue.length})`}>
          <p className="mb-2 text-xs text-zinc-500">
            Länger nichts gehört als das Frequenzziel erlaubt (Ziel pro Person im
            Freunde-Panel auf der Kontaktseite einstellbar, Standard 42 Tage)
          </p>
          <ul className="space-y-1 text-sm">
            {overdue.map(({ c, conn }) => (
              <li key={c.id} className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    conn.score >= 80 ? "bg-rose-500" : "bg-amber-500"
                  }`}
                />
                <Link href={`/contacts/${c.id}`} className="font-medium text-white hover:underline">
                  {c.name}
                </Link>
                <span className="text-xs text-zinc-500">
                  {conn.daysSince == null
                    ? "noch nie Kontakt geloggt"
                    : `${conn.daysSince} Tage her · Ziel alle ${c.contact_frequency_days ?? 42}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ContactsTable contacts={contacts ?? []} />
    </div>
  )
}
