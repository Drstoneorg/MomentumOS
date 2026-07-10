import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ContactsTable } from "@/app/contacts/ContactsTable"

export const dynamic = "force-dynamic"

/** MomentOS-Kontakte: Freunde und echte Bekannte — getrennt von der Matchbox. */
export default async function MomentsPeoplePage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("realm", "moment")
    .order("updated_at", { ascending: false })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Kontakte</h1>
        <p className="text-sm text-zinc-400">
          Deine MomentOS-Kontakte — Menschen, die du wirklich kennst. Matches wohnen in der{" "}
          <Link href="/contacts" className="text-rose-400 hover:underline">Matchbox</Link>.
        </p>
      </div>
      <ContactsTable contacts={contacts ?? []} />
    </div>
  )
}
