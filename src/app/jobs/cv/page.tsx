import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui"
import type { CvProfile, CvDocument } from "@/lib/ai/jobs"
import { CvClient } from "./CvClient"

export const dynamic = "force-dynamic"

export default async function CvPage() {
  const supabase = await createClient()
  const [{ data: cvRow }, { data: docRow }, { data: contactRow }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "job_cv_profile").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "job_cv_document").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "job_cv_contact").maybeSingle(),
  ])
  const cv = (cvRow?.value as CvProfile | null) ?? null
  const doc = (docRow?.value as CvDocument | null) ?? null
  const contact = typeof contactRow?.value === "string" ? contactRow.value : ""

  if (!cv) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">📄 CV-Profil</h1>
        <Card title="Noch kein Profil gespeichert">
          <p className="text-sm text-zinc-400">
            Erst unter{" "}
            <Link href="/jobs" className="text-emerald-400 hover:underline">
              JobOS → Bewerbungen
            </Link>{" "}
            den Lebenslauf hochladen (URL oder Text)
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold">📄 CV-Profil: {cv.name || "ohne Name"}</h1>
        <Link href="/jobs" className="text-sm text-emerald-400 hover:underline">
          → Bewerbungen
        </Link>
      </div>

      {/* Extrahiertes Rohprofil */}
      <div className="grid gap-4 md:grid-cols-2 print:hidden">
        <Card title={`💡 ${cv.headline || "Profil"}`}>
          <div className="flex flex-wrap gap-1.5">
            {cv.skills.map((s) => (
              <span key={s} className="rounded-full bg-emerald-950/60 px-2 py-0.5 text-xs text-emerald-300">
                {s}
              </span>
            ))}
          </div>
          {(cv.languages.length > 0 || cv.extras.length > 0) && (
            <div className="mt-3 space-y-1 text-sm text-zinc-400">
              {cv.languages.length > 0 && <p>🌐 {cv.languages.join(" · ")}</p>}
              {cv.extras.length > 0 && <p>➕ {cv.extras.join(" · ")}</p>}
            </div>
          )}
        </Card>
        <Card title="🎓 Ausbildung & Stationen">
          <ul className="space-y-2 text-sm">
            {cv.experience.map((e, i) => (
              <li key={i}>
                <span className="font-medium text-zinc-200">{e.role}</span>
                <span className="text-zinc-400">
                  {" "}
                  — {e.company}
                  {e.period ? ` (${e.period})` : ""}
                </span>
              </li>
            ))}
            {cv.education.map((e) => (
              <li key={e} className="text-zinc-400">
                🎓 {e}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Generator + druckfertige A4-Ansicht */}
      <CvClient doc={doc} contact={contact} />
    </div>
  )
}
