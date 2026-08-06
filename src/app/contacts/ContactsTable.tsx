"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { bulkAddTags, bulkDeleteContacts } from "@/lib/actions"
import { connectionScore, daysUntilBirthday, scoreColor } from "@/lib/moments"
import type { MatchScore } from "@/lib/scoring"
import { StageBadge, PriorityDot, inputCls, btnCls } from "@/components/ui"
import { Avatar } from "@/components/Avatar"
import type { Tables } from "@/lib/database.types"

type SortKey = "name" | "platform" | "location" | "birthday" | "last_contact" | "score" | "match" | "stage"

export function ContactsTable({
  contacts,
  scores = {},
}: {
  contacts: Tables<"contacts">[]
  scores?: Record<string, MatchScore>
}) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [sort, setSort] = useState<SortKey>("last_contact")
  const [asc, setAsc] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [tagInput, setTagInput] = useState("")
  const [pending, start] = useTransition()

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = contacts
    if (needle) {
      list = list.filter((c) =>
        [c.name, c.location, c.platform, c.bio, c.notes, (c.relationship_tags ?? []).join(" "), (c.interests ?? []).join(" ")]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle)
      )
    }
    const val = (c: Tables<"contacts">): string | number => {
      switch (sort) {
        case "name": return c.name.toLowerCase()
        case "platform": return c.platform
        case "location": return c.location?.toLowerCase() ?? "zzz"
        case "birthday": return daysUntilBirthday(c.birthday) ?? 9999
        case "last_contact": return c.last_contact_at ?? c.updated_at ?? ""
        case "score": return connectionScore(c).score
        case "match": return scores[c.id]?.score ?? -1
        case "stage": return c.pipeline_stage
      }
    }
    return [...list].sort((a, b) => {
      const va = val(a), vb = val(b)
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return asc ? cmp : -cmp
    })
  }, [contacts, q, sort, asc, scores])

  function header(key: SortKey, label: string) {
    return (
      <th
        onClick={() => (sort === key ? setAsc(!asc) : (setSort(key), setAsc(key === "name")))}
        className="cursor-pointer select-none px-3 py-2 hover:text-white"
      >
        {label} {sort === key ? (asc ? "↑" : "↓") : ""}
      </th>
    )
  }

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function applyTags() {
    start(async () => {
      await bulkAddTags([...sel], tagInput.split(",").map((t) => t.trim()).filter(Boolean))
      setSel(new Set())
      setTagInput("")
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Suche (Name, Ort, Tags, Notizen …)"
          className={inputCls + " max-w-xs"}
        />
        <span className="text-xs text-zinc-500">{rows.length} von {contacts.length}</span>
        {sel.size > 0 && (
          <div className="ml-auto flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1">
            <span className="text-xs text-zinc-400">{sel.size} ausgewählt:</span>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Tags, komma-getrennt"
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-xs"
            />
            <button onClick={applyTags} disabled={pending || !tagInput.trim()} className={btnCls + " !px-2 !py-0.5 text-xs"}>
              {pending ? "…" : "Taggen"}
            </button>
            <button
              onClick={() => {
                if (!confirm(`${sel.size} Kontakt(e) endgültig löschen? Chats, Gedächtnis und Follow-ups gehen mit.`)) return
                start(async () => {
                  await bulkDeleteContacts([...sel])
                  setSel(new Set())
                  router.refresh()
                })
              }}
              disabled={pending}
              className="rounded-lg border border-red-900 px-2 py-0.5 text-xs text-red-400 hover:bg-red-950/50"
            >
              {pending ? "…" : "🗑 Löschen"}
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-zinc-400">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((r) => sel.has(r.id))}
                  onChange={(e) =>
                    setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())
                  }
                />
              </th>
              {header("name", "Name")}
              {header("platform", "Plattform")}
              {header("location", "Ort")}
              {header("birthday", "Geburtstag")}
              {header("last_contact", "Letzter Kontakt")}
              {header("match", "Match")}
              {header("score", "Verbindung")}
              {header("stage", "Stage")}
              <th className="px-3 py-2">Tags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const days = daysUntilBirthday(c.birthday)
              const conn = connectionScore(c)
              return (
                <tr key={c.id} className="border-t border-zinc-800 hover:bg-zinc-900/60">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/contacts/${c.id}`} className="flex items-center gap-2 font-medium text-white">
                      <Avatar name={c.name} url={c.avatar_url} size="sm" />
                      <PriorityDot priority={c.priority} />
                      {c.name}
                      {c.age ? <span className="text-zinc-500">{c.age}</span> : null}
                      {c.intent === "event_lead" && (
                        <span title="Event-Lead: Gast-Funnel statt Date-Spur" className="text-xs">🎟</span>
                      )}
                      {c.intent === "both" && (
                        <span title="Date-Spur UND Event-Gast" className="text-xs">💘🎟</span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{c.platform}</td>
                  <td className="px-3 py-2 text-zinc-400">{c.location ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-400">
                    {days === null ? "—" : days === 0 ? "🎂 heute!" : `in ${days}d`}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {conn.daysSince === null ? "—" : conn.daysSince === 0 ? "heute" : `vor ${conn.daysSince}d`}
                  </td>
                  <td className="px-3 py-2">
                    {scores[c.id] ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white ${scores[c.id].color}`}
                        title={scores[c.id].factors.map((f) => `${f.label}: ${f.note}`).join(" · ")}
                      >
                        {scores[c.id].score} {scores[c.id].label}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={`h-full ${scoreColor(conn.score)}`}
                        style={{ width: `${conn.score}%` }}
                        title={`Score ${conn.score}${conn.overdue ? " — überfällig" : ""}`}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2"><StageBadge stage={c.pipeline_stage} /></td>
                  <td className="px-3 py-2">
                    <div className="flex max-w-40 flex-wrap gap-1">
                      {(c.relationship_tags ?? []).map((t) => (
                        <span key={t} className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-zinc-500">
                  {contacts.length ? "Keine Treffer." : "Noch keine Kontakte. Leg den ersten an."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
