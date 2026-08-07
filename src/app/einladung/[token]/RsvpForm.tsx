"use client"

import { useState } from "react"

/**
 * Zusage/Absage-Formular der öffentlichen Einladungs-Seite. Antwort ist
 * jederzeit über denselben Link änderbar — der Zustand kommt vom Server,
 * hier wird nur optimistisch nachgezogen.
 */
export function RsvpForm({
  token,
  status,
  plusOnes,
  statusFinal,
}: {
  token: string
  status: string
  plusOnes: number
  statusFinal: boolean
}) {
  const [aktuell, setAktuell] = useState(status)
  const [begleitung, setBegleitung] = useState(plusOnes)
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [gespeichert, setGespeichert] = useState(false)

  async function senden(antwort: "ja" | "nein", plus: number) {
    setLaeuft(true)
    setFehler(null)
    setGespeichert(false)
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, antwort, plus_ones: plus }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string; error?: string }
      if (!res.ok || !data.ok) {
        setFehler(data.error || "Das hat nicht geklappt, bitte nochmal")
        return
      }
      setAktuell(data.status ?? antwort)
      setBegleitung(antwort === "ja" ? plus : 0)
      setGespeichert(true)
    } catch {
      setFehler("Keine Verbindung, bitte nochmal versuchen")
    } finally {
      setLaeuft(false)
    }
  }

  const zugesagt = ["yes", "ticket", "attended"].includes(aktuell)
  const abgesagt = aktuell === "no"

  return (
    <div className="space-y-4">
      {statusFinal ? (
        <p className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-3 text-sm text-emerald-200">
          {aktuell === "attended" ? "Du warst dabei 🖤" : "Du hast schon ein Ticket 🎟"} — unten kannst
          du nur noch deine Begleitung anpassen.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => senden("ja", begleitung)}
            disabled={laeuft}
            className={`rounded-xl px-4 py-3 text-base font-semibold transition ${
              zugesagt
                ? "bg-emerald-600 text-white"
                : "border border-zinc-600 text-zinc-200 hover:border-emerald-500 hover:text-emerald-300"
            }`}
          >
            Bin dabei 🖤
          </button>
          <button
            onClick={() => senden("nein", 0)}
            disabled={laeuft}
            className={`rounded-xl px-4 py-3 text-base font-semibold transition ${
              abgesagt
                ? "bg-zinc-700 text-white"
                : "border border-zinc-600 text-zinc-200 hover:border-zinc-400"
            }`}
          >
            Diesmal nicht
          </button>
        </div>
      )}

      {(zugesagt || statusFinal) && (
        <div className="flex items-center justify-between rounded-xl border border-zinc-700 px-4 py-3">
          <span className="text-sm text-zinc-300">Begleitung (+{begleitung})</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => senden("ja", Math.max(0, begleitung - 1))}
              disabled={laeuft || begleitung === 0}
              className="h-9 w-9 rounded-full border border-zinc-600 text-lg text-zinc-200 disabled:opacity-30"
              aria-label="eine Begleitung weniger"
            >
              −
            </button>
            <span className="w-4 text-center font-semibold text-white">{begleitung}</span>
            <button
              onClick={() => senden("ja", Math.min(3, begleitung + 1))}
              disabled={laeuft || begleitung >= 3}
              className="h-9 w-9 rounded-full border border-zinc-600 text-lg text-zinc-200 disabled:opacity-30"
              aria-label="eine Begleitung mehr"
            >
              +
            </button>
          </div>
        </div>
      )}

      {gespeichert && <p className="text-sm text-emerald-400">Gespeichert 🖤 du kannst deine Antwort über diesen Link jederzeit ändern</p>}
      {fehler && <p className="text-sm text-red-400">{fehler}</p>}
    </div>
  )
}
