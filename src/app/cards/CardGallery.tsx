"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { deleteCard } from "@/lib/cardActions"
import { CardSend } from "./CardSend"
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
  const [channelsByContact, setChannelsByContact] = useState<Record<string, Channel[]>>({})
  const nameById = new Map(contacts.map((c) => [c.id, c.name]))
  if (!cards.length) return null

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
              {a.content && (
                <a href={a.content} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.content} alt={a.title ?? "Karte"} className="w-full object-cover" />
                </a>
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

                <button
                  onClick={() => toggleSend(a.id, a.contact_id)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                >
                  {openSend === a.id ? "Versenden schließen" : "📤 Versenden"}
                </button>

                {openSend === a.id && (
                  <CardSend
                    contactId={a.contact_id ?? ""}
                    assetId={a.id}
                    imageUrl={a.content || null}
                    channels={a.contact_id ? (channelsByContact[a.contact_id] ?? []) : []}
                    defaultText={`Hier deine persönliche Karte 🃏 ${c.title ?? a.title ?? ""}`}
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
