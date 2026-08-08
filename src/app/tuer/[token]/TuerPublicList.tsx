"use client"

import { useMemo, useState } from "react"

type Gast = {
  inviteId: string
  name: string
  status: string
  plus_ones: number
  companion_names: string | null
}

/**
 * Abhak-Liste für die Tür-Person: großer Tap-Bereich, optimistische Anzeige,
 * Check-in über /api/door-checkin mit dem Tür-Token.
 */
export function TuerPublicList({ doorToken, gaeste }: { doorToken: string; gaeste: Gast[] }) {
  const [status, setStatus] = useState<Record<string, string>>(
    Object.fromEntries(gaeste.map((g) => [g.inviteId, g.status]))
  )
  const [laeuft, setLaeuft] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [suche, setSuche] = useState("")

  const sichtbar = useMemo(() => {
    const n = suche.trim().toLowerCase()
    const liste = n ? gaeste.filter((g) => g.name.toLowerCase().includes(n)) : gaeste
    return [...liste].sort(
      (a, b) =>
        (status[a.inviteId] === "attended" ? 1 : 0) - (status[b.inviteId] === "attended" ? 1 : 0) ||
        a.name.localeCompare(b.name)
    )
  }, [gaeste, suche, status])

  const da = gaeste.filter((g) => status[g.inviteId] === "attended")
  const daMitBegleitung = da.length + da.reduce((s, g) => s + g.plus_ones, 0)

  async function toggle(g: Gast) {
    const alt = status[g.inviteId]
    const undo = alt === "attended"
    setLaeuft(g.inviteId)
    setFehler(null)
    // Optimistisch — bei Fehler zurückdrehen
    setStatus((s) => ({ ...s, [g.inviteId]: undo ? "yes" : "attended" }))
    try {
      const res = await fetch("/api/door-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ door_token: doorToken, invite_id: g.inviteId, undo }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string }
      if (!res.ok || !data.ok) throw new Error("Check-in fehlgeschlagen")
      setStatus((s) => ({ ...s, [g.inviteId]: data.status ?? (undo ? "yes" : "attended") }))
    } catch {
      setStatus((s) => ({ ...s, [g.inviteId]: alt }))
      setFehler("Kein Netz oder abgelehnt — nochmal tippen")
    } finally {
      setLaeuft(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 -mx-1 bg-zinc-950/95 px-1 pb-2 pt-1 backdrop-blur">
        <p className="mb-2 text-sm text-zinc-300">
          <span className="text-lg font-bold text-emerald-400">{daMitBegleitung}</span> im Haus (
          {da.length} Gäste + Begleitungen) · {gaeste.length - da.length} erwartet
        </p>
        <input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="🔍 Name…"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-white placeholder:text-zinc-600 focus:outline-none"
        />
        {fehler && <p className="mt-1 text-xs text-red-400">{fehler}</p>}
      </div>

      {sichtbar.map((g) => {
        const daNow = status[g.inviteId] === "attended"
        return (
          <button
            key={g.inviteId}
            onClick={() => toggle(g)}
            disabled={laeuft === g.inviteId}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
              daNow
                ? "border-emerald-800/60 bg-emerald-950/30"
                : "border-zinc-800 bg-zinc-900/70 active:bg-zinc-800"
            }`}
          >
            <span className="min-w-0">
              <span className={`block truncate text-base font-semibold ${daNow ? "text-emerald-200" : "text-white"}`}>
                {g.name}
                {g.plus_ones > 0 && (
                  <span className="ml-1 text-sm font-normal text-fuchsia-300">+{g.plus_ones}</span>
                )}
              </span>
              {g.companion_names && (
                <span className="block truncate text-xs text-zinc-500">mit {g.companion_names}</span>
              )}
            </span>
            <span className={`ml-auto text-2xl ${daNow ? "" : "opacity-25"}`}>{daNow ? "✅" : "⬜️"}</span>
          </button>
        )
      })}
      {sichtbar.length === 0 && (
        <p className="py-6 text-center text-sm text-zinc-500">Niemand gefunden</p>
      )}
    </div>
  )
}
