"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { deleteCard } from "@/lib/cardActions"
import { CardSend } from "./CardSend"
import { CardFrame } from "./CardFrame"
import type { Tables } from "@/lib/database.types"

type Channel = { channel: string; handle: string; is_primary?: boolean }

type CardMeta = {
  card?: {
    title?: string
    type_line?: string
    element?: string
    rarity?: string
    attack?: number
    defense?: number
    effect?: string
    flavor?: string
  }
  facts_used?: string[]
  fact_ids?: string[]
  template_id?: string | null
  wishes?: string | null
  overlay?: boolean
}

export function CardGallery({
  cards,
  contacts,
}: {
  cards: Tables<"moment_assets">[]
  contacts: { id: string; name: string }[]
}) {
  const [, start] = useTransition()
  const [openSend, setOpenSend] = useState<string | null>(null)
  const [rerolling, setRerolling] = useState<string | null>(null)
  const [rerollError, setRerollError] = useState<{ id: string; msg: string } | null>(null)
  const [channelsByContact, setChannelsByContact] = useState<Record<string, Channel[]>>({})
  const nameById = new Map(contacts.map((c) => [c.id, c.name]))
  if (!cards.length) return null

  // Re-Roll: gleiche Einstellungen (Kontakt, Fakten, Vorlage, Wünsche), neuer Wurf.
  // Alte Karten ohne fact_ids nutzen alle freigegebenen Fakten.
  async function reroll(assetId: string, contactId: string, meta: CardMeta) {
    setRerolling(assetId)
    setRerollError(null)
    try {
      const res = await fetch("/api/cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          factIds: meta.fact_ids ?? undefined,
          templateId: meta.template_id ?? undefined,
          wishes: meta.wishes ?? undefined,
          withImage: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Fehler")
      window.location.reload()
    } catch (e) {
      setRerollError({ id: assetId, msg: e instanceof Error ? e.message : "Re-Roll-Fehler" })
      setRerolling(null)
    }
  }

  async function toggleSend(assetId: string, contactId: string | null) {
    if (openSend === assetId) return setOpenSend(null)
    setOpenSend(assetId)
    if (contactId && !channelsByContact[contactId]) {
      try {
        const res = await fetch(`/api/cards/facts?contactId=${contactId}`)
        const data = await res.json()
        if (res.ok) {
          setChannelsByContact((prev) => ({ ...prev, [contactId]: data.channels ?? [] }))
        }
      } catch {
        // Kanäle optional — Teilen geht auch ohne
      }
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-white">Karten-Sammlung</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((a) => {
          const meta = (a.meta ?? {}) as CardMeta
          const c = meta.card ?? {}
          return (
            <div key={a.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
              {meta.overlay ? (
                <div className="p-2">
                  <CardFrame imageUrl={a.content || null} card={c} />
                </div>
              ) : (
                a.content && (
                  <a href={a.content} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.content} alt={a.title ?? "Karte"} className="w-full object-cover" />
                  </a>
                )
              )}
              <div className="space-y-1 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-200">{c.title ?? a.title}</span>
                  <button
                    onClick={() => start(() => deleteCard(a.id))}
                    className="ml-auto text-xs text-zinc-600 hover:text-rose-400"
                    title="Karte löschen"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  {c.type_line} {c.element ? `· ${c.element}` : ""} {c.rarity ? `· ${c.rarity}` : ""}
                </p>
                {(c.attack != null || c.defense != null) && (
                  <p className="text-xs text-zinc-300">⚔ {c.attack ?? "?"} / 🛡 {c.defense ?? "?"}</p>
                )}
                {c.effect && <p className="text-xs text-zinc-300">{c.effect}</p>}
                {c.flavor && <p className="text-xs italic text-zinc-500">{c.flavor}</p>}
                <p className="pt-1 text-xs text-zinc-600">
                  {a.contact_id ? (
                    <Link href={`/contacts/${a.contact_id}`} className="text-rose-400 hover:underline">
                      {nameById.get(a.contact_id) ?? "Kontakt"}
                    </Link>
                  ) : (
                    "ohne Kontakt"
                  )}
                  {" · "}
                  {new Date(a.created_at).toLocaleDateString("de-DE")}
                </p>

                <div className="mt-1 flex gap-1.5">
                  <button
                    onClick={() => toggleSend(a.id, a.contact_id)}
                    className="flex-1 rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    {openSend === a.id ? "Versenden schließen" : "📤 Versenden"}
                  </button>
                  {a.contact_id && (
                    <button
                      onClick={() => reroll(a.id, a.contact_id!, meta)}
                      disabled={rerolling === a.id}
                      title="Nochmal mit gleichen Einstellungen (kostet Bild-Generierung)"
                      className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
                    >
                      {rerolling === a.id ? "🎲 …" : "🎲 Nochmal"}
                    </button>
                  )}
                </div>
                {rerollError?.id === a.id && (
                  <p className="text-xs text-rose-400">{rerollError.msg}</p>
                )}

                {openSend === a.id && (
                  <CardSend
                    contactId={a.contact_id ?? ""}
                    assetId={a.id}
                    imageUrl={a.content || null}
                    channels={a.contact_id ? (channelsByContact[a.contact_id] ?? []) : []}
                    defaultText={
                      meta.overlay
                        ? `Hier deine persönliche Karte 🃏 ${c.title ?? a.title ?? ""}${c.type_line ? ` (${c.type_line})` : ""}${c.effect ? ` — ${c.effect}` : ""}`
                        : `Hier deine persönliche Karte 🃏 ${c.title ?? a.title ?? ""}`
                    }
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
