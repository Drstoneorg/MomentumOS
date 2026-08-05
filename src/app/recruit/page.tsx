import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { RecruitBoard } from "./RecruitBoard"
import { QuickAddModel } from "./QuickAddModel"

export const dynamic = "force-dynamic"

export default async function RecruitPage() {
  const supabase = await createClient()
  const [modelsRes, appsRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, location, platform, external_id, recruit_stage, created_at")
      .eq("realm", "recruit")
      .order("created_at", { ascending: false }),
    supabase
      .from("recruit_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
  ])
  const models = modelsRes.data ?? []
  const newApps = appsRes.count ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">RecruitOS — Pipeline</h1>
          <p className="text-sm text-zinc-400">
            TFP-Scouting: erfassen, anschreiben (immer selbst senden), Shooting, Lieferung
          </p>
        </div>
        <QuickAddModel />
      </div>

      {newApps > 0 && (
        <Link
          href="/recruit/bewerbungen"
          className="block rounded-xl border border-fuchsia-800/60 bg-fuchsia-950/40 px-4 py-3 text-sm text-fuchsia-200 hover:bg-fuchsia-950/60"
        >
          📸 {newApps} neue {newApps === 1 ? "Bewerbung" : "Bewerbungen"} über die
          Landing-Seite — jetzt sichten →
        </Link>
      )}

      {models.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-400">
          <p className="mb-2 font-medium text-zinc-200">Noch keine Models in der Pipeline</p>
          <p>
            Drei Wege hinein: selbst eintragen (oben rechts), Bewerbungen über die{" "}
            <Link href="/model" className="text-fuchsia-400 underline">
              öffentliche Landing-Seite
            </Link>{" "}
            übernehmen, oder auf einem Instagram-/TikTok-Profil die Extension nutzen.
            Grundregeln: kein Scraping, keine Massen-Nachrichten — jede Nachricht gehst
            du selbst durch und sendest sie selbst.
          </p>
        </div>
      ) : (
        <RecruitBoard models={models} />
      )}
    </div>
  )
}
