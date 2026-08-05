import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { acceptApplicationForm, rejectApplicationForm } from "../actions"

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, string> = {
  new: "neu",
  accepted: "übernommen",
  rejected: "abgelehnt",
}

export default async function RecruitApplicationsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("recruit_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)
  const apps = data ?? []
  const neue = apps.filter((a) => a.status === "new")
  const erledigte = apps.filter((a) => a.status !== "new")

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Model-Bewerbungen</h1>
        <p className="text-sm text-zinc-400">
          Einlauf der{" "}
          <Link href="/model" className="text-fuchsia-400 underline">
            Landing-Seite
          </Link>{" "}
          — Übernehmen legt den Kontakt in der Pipeline an (Stufe &bdquo;Interessiert&ldquo;)
        </p>
      </div>

      {apps.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-400">
          Noch keine Bewerbungen. Die Landing-Seite lebt unter{" "}
          <span className="text-zinc-200">/model</span> — QR-Code auf Events und Link in
          der Insta-Bio sind die zwei stärksten Zubringer.
        </div>
      )}

      {[...neue, ...erledigte].map((a) => (
        <div
          key={a.id}
          className={`rounded-xl border p-4 ${
            a.status === "new" ? "border-fuchsia-800/60 bg-zinc-900/80" : "border-zinc-800 bg-zinc-900/40 opacity-70"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">
                {a.name}{" "}
                <span className="text-xs font-normal text-zinc-500">
                  {STATUS_LABEL[a.status] ?? a.status} ·{" "}
                  {new Date(a.created_at).toLocaleDateString("de-DE")}
                </span>
              </p>
              <p className="mt-0.5 text-sm text-zinc-400">
                {[
                  a.city,
                  a.instagram ? `@${a.instagram.replace(/^@/, "")}` : null,
                  a.email,
                  a.style ? `Stil: ${a.style}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {a.message && <p className="mt-2 text-sm text-zinc-300">{a.message}</p>}
              <p className="mt-1 text-xs text-zinc-600">
                Einwilligung: {a.consent ? "ja" : "NEIN"} · 18+ bestätigt:{" "}
                {a.age_confirmed ? "ja" : "NEIN"}
              </p>
            </div>
            {a.status === "new" && (
              <div className="flex gap-2">
                <form action={acceptApplicationForm.bind(null, a.id)}>
                  <button className="rounded-lg bg-fuchsia-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-600">
                    Übernehmen
                  </button>
                </form>
                <form action={rejectApplicationForm.bind(null, a.id)}>
                  <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">
                    Ablehnen
                  </button>
                </form>
              </div>
            )}
            {a.status === "accepted" && a.contact_id && (
              <Link
                href={`/contacts/${a.contact_id}`}
                className="text-sm text-fuchsia-400 underline"
              >
                Zum Kontakt →
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
