import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { StageBadge, PriorityDot } from "@/components/ui"
import { NewContactButton } from "./NewContactButton"
import { SmartImportButton } from "./SmartImportButton"

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

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-zinc-400">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Plattform</th>
              <th className="px-4 py-2">Ort</th>
              <th className="px-4 py-2">Stage</th>
              <th className="px-4 py-2">Nächster Schritt</th>
            </tr>
          </thead>
          <tbody>
            {(contacts ?? []).map((c) => (
              <tr key={c.id} className="border-t border-zinc-800 hover:bg-zinc-900/60">
                <td className="px-4 py-2">
                  <Link href={`/contacts/${c.id}`} className="flex items-center gap-2 font-medium text-white">
                    <PriorityDot priority={c.priority} />
                    {c.name}
                    {c.age ? <span className="text-zinc-500">{c.age}</span> : null}
                  </Link>
                </td>
                <td className="px-4 py-2 text-zinc-400">{c.platform}</td>
                <td className="px-4 py-2 text-zinc-400">{c.location ?? "—"}</td>
                <td className="px-4 py-2"><StageBadge stage={c.pipeline_stage} /></td>
                <td className="max-w-xs truncate px-4 py-2 text-zinc-400">{c.next_step ?? "—"}</td>
              </tr>
            ))}
            {!contacts?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  Noch keine Matches. Leg das erste an.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
