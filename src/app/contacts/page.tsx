import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { NewContactButton } from "./NewContactButton"
import { SmartImportButton } from "./SmartImportButton"
import { FileImportButton } from "./FileImportButton"
import { ContactsTable } from "./ContactsTable"

export const dynamic = "force-dynamic"

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; platform?: string }>
}) {
  const { stage, platform } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from("contacts")
    .select("*")
    .order("updated_at", { ascending: false })
  if (stage) query = query.eq("pipeline_stage", stage as never)
  if (platform) query = query.eq("platform", platform)
  const { data: contacts } = await query

  const platforms = [...new Set((contacts ?? []).map((c) => c.platform))]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Matchbox</h1>
        <div className="flex gap-2">
          <FileImportButton />
          <SmartImportButton />
          <NewContactButton />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/contacts"
          className={`rounded-full px-3 py-1 ${!platform ? "bg-zinc-800 text-white" : "text-zinc-400"}`}
        >
          Alle
        </Link>
        {platforms.map((p) => (
          <Link
            key={p}
            href={`/contacts?platform=${p}`}
            className={`rounded-full px-3 py-1 ${platform === p ? "bg-zinc-800 text-white" : "text-zinc-400"}`}
          >
            {p}
          </Link>
        ))}
      </div>

      <ContactsTable contacts={contacts ?? []} />
    </div>
  )
}
