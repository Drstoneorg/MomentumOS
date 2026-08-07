"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { setInviteStatus } from "@/lib/momentsActions"
import { Avatar } from "@/components/Avatar"
import { inputCls } from "@/components/ui"

type Gast = {
  inviteId: string
  contactId: string
  name: string
  avatar_url: string | null
  status: string
  plus_ones: number
  promo_code: string | null
}

/**
 * Tür-Modus: fürs Handy am Einlass. Ein Tap hakt den Gast ab (Status attended),
 * nochmal tippen macht es rückgängig. Große Ziele, nichts zum Vertippen.
 */
export function DoorList({ eventId, gaeste }: { eventId: string; gaeste: Gast[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [suche, setSuche] = useState("")

  const sichtbar = useMemo(() => {
    const n = suche.trim().toLowerCase()
    const liste = n ? gaeste.filter((g) => g.name.toLowerCase().includes(n)) : gaeste
    // Noch nicht Eingecheckte zuerst, dann alphabetisch
    return [...liste].sort((a, b) =>
      (a.status === "attended" ? 1 : 0) - (b.status === "attended" ? 1 : 0) || a.name.localeCompare(b.name)
    )
  }, [gaeste, suche])

  const da = gaeste.filter((g) => g.status === "attended")
  const daMitBegleitung = da.length + da.reduce((s, g) => s + g.plus_ones, 0)

  function toggleCheckin(g: Gast) {
    start(async () => {
      await setInviteStatus(g.inviteId, eventId, g.status === "attended" ? "yes" : "attended")
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 -mx-1 bg-zinc-950/95 px-1 pb-2 pt-1 backdrop-blur">
        <p className="mb-2 text-sm text-zinc-300">
          <span className="text-lg font-bold text-emerald-400">{daMitBegleitung}</span> im Haus
          ({da.length} Gäste + Begleitungen) · {gaeste.length - da.length} erwartet
        </p>
        <input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="🔍 Name…"
          className={inputCls}
        />
      </div>

      {sichtbar.map((g) => {
        const da = g.status === "attended"
        return (
          <button
            key={g.inviteId}
            onClick={() => toggleCheckin(g)}
            disabled={pending}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
              da
                ? "border-emerald-800/60 bg-emerald-950/30"
                : "border-zinc-800 bg-zinc-900/70 active:bg-zinc-800"
            }`}
          >
            <Avatar name={g.name} url={g.avatar_url} size="md" />
            <span className="min-w-0">
              <span className={`block truncate text-base font-semibold ${da ? "text-emerald-200" : "text-white"}`}>
                {g.name}
                {g.plus_ones > 0 && <span className="ml-1 text-sm font-normal text-fuchsia-300">+{g.plus_ones}</span>}
              </span>
              {g.promo_code && (
                <span className="block font-mono text-xs text-zinc-500">{g.promo_code}</span>
              )}
            </span>
            <span className={`ml-auto text-2xl ${da ? "" : "opacity-25"}`}>{da ? "✅" : "⬜️"}</span>
          </button>
        )
      })}
      {sichtbar.length === 0 && (
        <p className="py-6 text-center text-sm text-zinc-500">Niemand gefunden</p>
      )}
    </div>
  )
}
