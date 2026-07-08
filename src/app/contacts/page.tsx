import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { NewContactButton } from "./NewContactButton"
import { SmartImportButton } from "./SmartImportButton"
import { FileImportButton } from "./FileImportButton"
import { ContactsTable } from "./ContactsTable"
import { datingScore, type MatchScore, type ScoreMessage } from "@/lib/scoring"

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

  // Match-Score pro Kontakt aus Nachrichten-Metadaten (ein Query für alle).
  const ids = (contacts ?? []).map((c) => c.id)
  const scores: Record<string, MatchScore> = {}
  if (ids.length) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("contact_id, direction, sent_at")
      .in("contact_id", ids)
    const byContact = new Map<string, ScoreMessage[]>()
    for (const m of msgs ?? []) {
      const arr = byContact.get(m.contact_id) ?? []
      arr.push({ direction: m.direction as "in" | "out", sent_at: m.sent_at })
      byContact.set(m.contact_id, arr)
    }
    for (const c of contacts ?? []) {
      scores[c.id] = datingScore(byContact.get(c.id) ?? [], { pipeline_stage: c.pipeline_stage })
    }
  }

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

      <ContactsTable contacts={contacts ?? []} scores={scores} />
    </div>
  )
}
