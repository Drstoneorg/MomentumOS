import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { MergePair } from "./MergePair"

export const dynamic = "force-dynamic"

const REALM_LABEL: Record<string, string> = {
  match: "Match",
  moment: "MomentOS",
  recruit: "Recruit",
}

/**
 * Dubletten-Kandidaten über alle Realms: gleiche Person auf zwei Plattformen
 * (ähnlicher Name per pg_trgm oder identischer Kanal-Handle). Der Merge selbst
 * läuft als eine DB-Transaktion.
 */
export default async function DublettenPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("find_duplicate_contacts")
  const paare = data ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">🔀 Dubletten</h1>
        <p className="text-sm text-zinc-400">
          Kandidaten: ähnlicher Name oder gleicher Kanal-Handle. Beim Zusammenführen wandern
          Nachrichten, Gedächtnis, Einladungen und Kanäle zum behaltenen Kontakt; leere Felder
          werden aus dem zweiten aufgefüllt.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-300">
          Kandidatensuche fehlgeschlagen: {error.message}
        </div>
      )}

      {!error && paare.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-400">
          Keine Dubletten-Kandidaten gefunden — sauber. Die Prüfung vergleicht Namen
          (Tippfehler-tolerant) und Kanal-Handles über alle Bereiche hinweg.
        </div>
      )}

      {paare.map((p) => (
        <div
          key={`${p.a_id}:${p.b_id}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href={`/contacts/${p.a_id}`} className="font-medium text-white underline-offset-2 hover:underline">
              {p.a_name}
            </Link>
            <span className="text-xs text-zinc-500">
              {p.a_platform} · {REALM_LABEL[p.a_realm] ?? p.a_realm}
            </span>
            <span className="text-zinc-600">↔</span>
            <Link href={`/contacts/${p.b_id}`} className="font-medium text-white underline-offset-2 hover:underline">
              {p.b_name}
            </Link>
            <span className="text-xs text-zinc-500">
              {p.b_platform} · {REALM_LABEL[p.b_realm] ?? p.b_realm}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                p.score >= 85 ? "bg-emerald-950/60 text-emerald-300" : "bg-amber-950/60 text-amber-300"
              }`}
              title={p.grund}
            >
              {p.score}% · {p.grund}
            </span>
          </div>
          <MergePair
            a={{ id: p.a_id, name: p.a_name, platform: p.a_platform }}
            b={{ id: p.b_id, name: p.b_name, platform: p.b_platform }}
          />
        </div>
      ))}
    </div>
  )
}
