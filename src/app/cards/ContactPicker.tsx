"use client"

import { useEffect, useMemo, useRef, useState } from "react"

export type PickContact = {
  id: string
  name: string
  realm: string
  platform: string
  relationship_tags: string[] | null
}

/**
 * Durchsuchbare Kontaktwahl für Karten: MomentOS-Kontakte (Hauptzweck) zuerst,
 * Matches als eigene Gruppe mit 💘-Prefix — skaliert auch mit vielen Kontakten.
 */
export function ContactPicker({
  contacts,
  value,
  onSelect,
}: {
  contacts: PickContact[]
  value: string
  onSelect: (id: string) => void
}) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const selected = contacts.find((c) => c.id === value)

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const hit = (c: PickContact) =>
      !needle ||
      [c.name, c.platform, (c.relationship_tags ?? []).join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    const byName = (a: PickContact, b: PickContact) => a.name.localeCompare(b.name, "de")
    return [
      { label: "MomentOS — Freunde & Kontakte", items: contacts.filter((c) => c.realm === "moment" && hit(c)) },
      { label: "MatchOS — Matches", items: contacts.filter((c) => c.realm !== "moment" && hit(c)).sort(byName) },
    ].map((g) => ({ ...g, items: g.items.sort(byName) }))
  }, [contacts, q])

  function context(c: PickContact): string {
    const tags = (c.relationship_tags ?? []).slice(0, 3).join(", ")
    return tags || c.platform
  }

  return (
    <div ref={ref} className="relative min-w-64">
      <input
        value={open ? q : selected ? selected.name : ""}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setQ("")
          setOpen(true)
        }}
        placeholder="🔍 Kontakt suchen…"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200"
      />
      {selected && !open && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wide text-zinc-500">
          {selected.realm === "moment" ? "MomentOS" : "💘 Match"}
        </span>
      )}
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-full min-w-72 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl">
          {groups.every((g) => !g.items.length) && (
            <p className="px-3 py-2 text-sm text-zinc-500">Kein Treffer</p>
          )}
          {groups.map(
            (g) =>
              g.items.length > 0 && (
                <div key={g.label}>
                  <p className="sticky top-0 bg-zinc-900 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    {g.label}
                  </p>
                  {g.items.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onSelect(c.id)
                        setOpen(false)
                        setQ("")
                      }}
                      className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-800 ${
                        c.id === value ? "bg-zinc-800 text-white" : "text-zinc-200"
                      }`}
                    >
                      <span className="font-medium">
                        {c.realm === "moment" ? c.name : `💘 ${c.name}`}
                      </span>
                      <span className="truncate text-xs text-zinc-500">{context(c)}</span>
                    </button>
                  ))}
                </div>
              )
          )}
        </div>
      )}
    </div>
  )
}
