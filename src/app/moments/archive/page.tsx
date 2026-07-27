import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type Meta = { prompt?: string; caption?: string; format?: string; quality?: string }

export default async function ArchivePage() {
  const supabase = await createClient()
  const { data: assets } = await supabase
    .from("moment_assets")
    .select("*")
    .eq("kind", "image")
    .order("created_at", { ascending: false })

  const list = assets ?? []
  const contactIds = [...new Set(list.map((a) => a.contact_id).filter(Boolean))] as string[]
  const assetIds = list.map((a) => a.id)

  const [{ data: contacts }, { data: sends }] = await Promise.all([
    contactIds.length
      ? supabase.from("contacts").select("id, name").in("id", contactIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    assetIds.length
      ? supabase.from("asset_sends").select("asset_id, channel, sent_at").in("asset_id", assetIds)
      : Promise.resolve({ data: [] as { asset_id: string; channel: string; sent_at: string }[] }),
  ])

  const nameById = new Map((contacts ?? []).map((c) => [c.id, c.name]))
  const sendsByAsset = new Map<string, { channel: string; sent_at: string }[]>()
  for (const s of sends ?? []) {
    const arr = sendsByAsset.get(s.asset_id) ?? []
    arr.push({ channel: s.channel, sent_at: s.sent_at })
    sendsByAsset.set(s.asset_id, arr)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Bild-Archiv</h1>
        <Link href="/moments" className="ml-auto rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">
          ← Moments
        </Link>
      </div>
      <p className="text-sm text-zinc-400">
        Alle erzeugten Bilder. „Gesendet&quot; zeigt, an wen/über welchen Kanal du das Bild verschickt hast (im Generator notiert).
      </p>

      {!list.length && (
        <p className="text-zinc-500">Noch keine Bilder — über den Moments-Generator auf einer Kontaktseite erzeugen.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => {
          const meta = (a.meta ?? {}) as Meta
          const sent = sendsByAsset.get(a.id) ?? []
          return (
            <div key={a.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
              <a href={a.content} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.content} alt={a.title ?? "Bild"} className="aspect-square w-full object-cover" />
              </a>
              <div className="space-y-1 p-3 text-sm">
                <div className="flex items-center gap-2">
                  {a.title && <span className="font-medium text-zinc-200">{a.title}</span>}
                  <span className="ml-auto text-xs text-zinc-500">
                    {new Date(a.created_at).toLocaleDateString("de-DE")}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  {a.contact_id ? (
                    <Link href={`/contacts/${a.contact_id}`} className="text-rose-400 hover:underline">
                      {nameById.get(a.contact_id) ?? "Kontakt"}
                    </Link>
                  ) : (
                    "ohne Kontakt"
                  )}
                  {meta.format ? ` · ${meta.format}` : ""}
                  {meta.quality ? ` · ${meta.quality}` : ""}
                </p>
                {sent.length ? (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {sent.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-emerald-700 bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300"
                        title={new Date(s.sent_at).toLocaleString("de-DE")}
                      >
                        ✓ {s.channel}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="pt-1 text-xs text-zinc-600">noch nicht verschickt</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
