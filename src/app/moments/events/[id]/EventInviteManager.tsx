"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { inviteToEvent, setInviteStatus, removeInvite, setInvitePromoCode } from "@/lib/momentsActions"
import { channelDeepLink } from "@/lib/channels"
import { RSVP_LABELS, type Enums } from "@/lib/database.types"
import { Card, inputCls, btnCls, btnGhostCls } from "@/components/ui"

type Invite = {
  id: string
  contact_id: string
  status: Enums<"event_invite_status">
  invite_text: string | null
  promo_code: string | null
  contacts: {
    name: string
    realm: string
    relationship_tags: string[] | null
    language: string | null
    contact_channels: { channel: string; handle: string }[]
  } | null
}

const STATUSES: Enums<"event_invite_status">[] = ["invited", "yes", "no", "no_reply", "ticket", "attended"]

/** Kurzer Promo-Code aus Namens-Präfix + Zufallsteil, z. B. CATA-7GX2 */
function makePromoCode(name: string): string {
  const prefix = name.replace(/[^a-z]/gi, "").slice(0, 4).toUpperCase() || "GAST"
  const rand = Array.from({ length: 4 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("")
  return `${prefix}-${rand}`
}

export function EventInviteManager({
  eventId,
  eventTitle,
  invites,
  allContacts,
}: {
  eventId: string
  eventTitle: string
  invites: Invite[]
  allContacts: { id: string; name: string; realm: string; relationship_tags: string[] | null }[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [picker, setPicker] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tagFilter, setTagFilter] = useState("")
  const [search, setSearch] = useState("")
  const [genFor, setGenFor] = useState<string | null>(null)
  const invitedIds = new Set(invites.map((i) => i.contact_id))

  const allTags = [...new Set(allContacts.flatMap((c) => c.relationship_tags ?? []))]
  const filtered = allContacts.filter(
    (c) =>
      !invitedIds.has(c.id) &&
      (!tagFilter || (c.relationship_tags ?? []).includes(tagFilter)) &&
      (!search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase()))
  )

  // Ticket-Funnel: eingeladen → zugesagt → Ticket → erschienen
  const funnel = {
    yes: invites.filter((i) => i.status === "yes").length,
    ticket: invites.filter((i) => i.status === "ticket").length,
    attended: invites.filter((i) => i.status === "attended").length,
  }

  async function genInvite(inv: Invite) {
    setGenFor(inv.id)
    const res = await fetch("/api/moments/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: inv.contact_id,
        kind: "invite",
        context: `Event: ${eventTitle}`,
      }),
    })
    const data = await res.json()
    setGenFor(null)
    if (!res.ok) return alert(data.error ?? "Fehler")
    const text = Object.values(data.variants)[0] as string
    start(async () => {
      await setInviteStatus(inv.id, eventId, inv.status, text)
      router.refresh()
    })
  }

  return (
    <Card title={`Einladungen (${invites.length})`}>
      {invites.length > 0 && (
        <p className="mb-3 text-xs text-zinc-400">
          Funnel: <span className="text-zinc-200">{invites.length}</span> eingeladen
          {" → "}<span className="text-emerald-300">{funnel.yes + funnel.ticket + funnel.attended}</span> zugesagt
          {" → "}<span className="text-violet-300">{funnel.ticket + funnel.attended}</span> 🎟 Ticket
          {" → "}<span className="text-amber-300">{funnel.attended}</span> ✔ da
        </p>
      )}
      <div className="mb-3">
        <button onClick={() => setPicker(!picker)} className={btnCls}>+ Personen einladen</button>
      </div>

      {picker && (
        <div className="mb-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Name suchen…"
            className={inputCls}
          />
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setTagFilter("")} className={`rounded-full px-2 py-0.5 text-xs ${!tagFilter ? "bg-zinc-700 text-white" : "text-zinc-400"}`}>Alle</button>
            {allTags.map((t) => (
              <button key={t} onClick={() => setTagFilter(t)} className={`rounded-full px-2 py-0.5 text-xs ${tagFilter === t ? "bg-zinc-700 text-white" : "text-zinc-400"}`}>{t}</button>
            ))}
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {filtered.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={(e) => {
                    const n = new Set(selected)
                    e.target.checked ? n.add(c.id) : n.delete(c.id)
                    setSelected(n)
                  }}
                />
                {c.realm === "match" ? `💘 ${c.name}` : c.name}
                {(c.relationship_tags?.length ?? 0) > 0 && (
                  <span className="text-xs text-zinc-600">{c.relationship_tags!.join(", ")}</span>
                )}
              </label>
            ))}
            {!filtered.length && <p className="text-sm text-zinc-500">Niemand (mehr) übrig.</p>}
          </div>
          <button
            onClick={() =>
              start(async () => {
                await inviteToEvent(eventId, [...selected])
                setSelected(new Set())
                setPicker(false)
                router.refresh()
              })
            }
            disabled={pending || !selected.size}
            className={btnCls}
          >
            {selected.size} einladen
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {invites.map((inv) => {
          return (
            <li key={inv.id} className="rounded-lg border border-zinc-800 p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">
                  {inv.contacts?.realm === "match" ? `💘 ${inv.contacts.name}` : inv.contacts?.name}
                </span>
                {inv.promo_code && (
                  <button
                    onClick={() => navigator.clipboard.writeText(inv.promo_code!)}
                    className="rounded bg-violet-950/50 px-1.5 py-0.5 font-mono text-xs text-violet-300 hover:bg-violet-900/50"
                    title="Promo-Code kopieren — im Ticketshop anlegen, dann siehst du, wer wirklich kauft"
                  >
                    {inv.promo_code}
                  </button>
                )}
                <select
                  value={inv.status}
                  onChange={(e) => start(async () => { await setInviteStatus(inv.id, eventId, e.target.value as Enums<"event_invite_status">); router.refresh() })}
                  className={inputCls + " ml-auto w-auto text-xs"}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{RSVP_LABELS[s]}</option>)}
                </select>
                <button onClick={() => start(async () => { await removeInvite(inv.id, eventId); router.refresh() })} className="text-zinc-600 hover:text-red-400">×</button>
              </div>
              {inv.invite_text ? (
                <p className="mt-2 rounded bg-zinc-950 p-2 text-sm text-zinc-300">{inv.invite_text}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => genInvite(inv)} disabled={genFor === inv.id} className={btnGhostCls}>
                  {genFor === inv.id ? "…" : inv.invite_text ? "Neu generieren" : "Einladungstext"}
                </button>
                {!inv.promo_code && (
                  <button
                    onClick={() =>
                      start(async () => {
                        await setInvitePromoCode(inv.id, eventId, makePromoCode(inv.contacts?.name ?? ""))
                        router.refresh()
                      })
                    }
                    className={btnGhostCls}
                    title="Individueller Rabatt-Code — im Ticketshop anlegen, misst wer über diesen Chat kauft"
                  >
                    🎟 Promo-Code
                  </button>
                )}
                {inv.invite_text && (
                  <button onClick={() => navigator.clipboard.writeText(inv.invite_text!)} className={btnGhostCls}>Kopieren</button>
                )}
                {inv.invite_text &&
                  (inv.contacts?.contact_channels ?? []).map((ch) => {
                    const l = channelDeepLink(ch.channel, ch.handle, inv.invite_text!)
                    if (!l.url) return null
                    return (
                      <a
                        key={ch.channel}
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        title={l.hint}
                        onClick={() => navigator.clipboard.writeText(inv.invite_text!)}
                        className={btnGhostCls}
                      >
                        {l.label} ↗
                      </a>
                    )
                  })}
              </div>
            </li>
          )
        })}
        {!invites.length && <li className="text-sm text-zinc-500">Noch niemand eingeladen.</li>}
      </ul>
    </Card>
  )
}
