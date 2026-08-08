"use client"

import { useState } from "react"

/**
 * „Will kommen"-Formular der öffentlichen Event-Seite: Name + Kontakt rein,
 * landet als Lead in der Gästeliste. Honeypot gegen Bots, Einwilligung Pflicht.
 */
export function LeadForm({ slug }: { slug: string }) {
  const [name, setName] = useState("")
  const [kontakt, setKontakt] = useState("")
  const [website, setWebsite] = useState("") // Honeypot — Menschen sehen das Feld nicht
  const [consent, setConsent] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [fertig, setFertig] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  async function absenden(e: React.FormEvent) {
    e.preventDefault()
    setFehler(null)
    setLaeuft(true)
    try {
      const res = await fetch("/api/event-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, kontakt, website, consent }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setFehler(data.error || "Das hat nicht geklappt, bitte nochmal")
        return
      }
      setFertig(true)
    } catch {
      setFehler("Keine Verbindung, bitte nochmal versuchen")
    } finally {
      setLaeuft(false)
    }
  }

  if (fertig) {
    return (
      <p className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-4 text-sm text-emerald-200">
        Danke 🖤 du bist vorgemerkt und hörst von mir mit allen Details
      </p>
    )
  }

  return (
    <form onSubmit={absenden} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-sm font-semibold text-white">Ich will kommen 🖤</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Dein Name"
        required
        maxLength={80}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
      />
      <input
        value={kontakt}
        onChange={(e) => setKontakt(e.target.value)}
        placeholder="Insta/Telegram/Mail — wie erreiche ich dich"
        required
        maxLength={120}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
      />
      {/* Honeypot: für Menschen unsichtbar, Bots füllen es aus */}
      <input
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <label className="flex items-start gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
          className="mt-0.5"
        />
        Ich bin einverstanden, dass meine Angaben zur Event-Orga gespeichert werden und ich zu
        diesem Event kontaktiert werde
      </label>
      <button
        type="submit"
        disabled={laeuft || !name.trim() || !kontakt.trim() || !consent}
        className="w-full rounded-xl bg-fuchsia-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        {laeuft ? "…" : "Vormerken"}
      </button>
      {fehler && <p className="text-sm text-red-400">{fehler}</p>}
    </form>
  )
}
