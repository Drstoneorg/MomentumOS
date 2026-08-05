"use client"

import { useState } from "react"

const CITIES = ["Wien", "Berlin", "London", "andere"]

export function ApplyForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [msg, setMsg] = useState("")

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const body = {
      name: String(fd.get("name") ?? ""),
      city: String(fd.get("city") ?? ""),
      instagram: String(fd.get("instagram") ?? ""),
      email: String(fd.get("email") ?? ""),
      style: String(fd.get("style") ?? ""),
      message: String(fd.get("message") ?? ""),
      consent: fd.get("consent") === "on",
      age_confirmed: fd.get("age") === "on",
      // Honeypot: für Menschen unsichtbar — Bots füllen es aus
      website: String(fd.get("website") ?? ""),
    }
    setState("sending")
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Senden fehlgeschlagen")
      setState("done")
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Senden fehlgeschlagen")
      setState("error")
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-xl border border-fuchsia-800/60 bg-fuchsia-950/30 p-6 text-center">
        <p className="text-lg font-medium">Danke für deine Bewerbung ✦</p>
        <p className="mt-1 text-sm text-zinc-400">
          Ich melde mich innerhalb weniger Tage über Instagram oder E-Mail zurück.
        </p>
      </div>
    )
  }

  const input =
    "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-fuchsia-500 focus:outline-none"

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-base font-medium">Bewerbung — dauert keine zwei Minuten</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-zinc-400">Name / Künstlername *</span>
          <input name="name" required minLength={2} maxLength={80} className={input} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-400">Stadt *</span>
          <select name="city" required className={input} defaultValue="Wien">
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-400">Instagram</span>
          <input name="instagram" maxLength={80} placeholder="@handle" className={input} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-400">E-Mail</span>
          <input name="email" type="email" maxLength={120} className={input} />
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="text-zinc-400">Dein Stil (Goth, Alt, Cyber, …)</span>
        <input name="style" maxLength={120} className={input} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-zinc-400">Was schwebt dir vor? (optional)</span>
        <textarea name="message" rows={3} maxLength={1000} className={input} />
      </label>

      {/* Honeypot — bleibt für Menschen unsichtbar */}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <label className="flex items-start gap-2 text-sm text-zinc-300">
        <input name="age" type="checkbox" required className="mt-0.5" />
        <span>Ich bin mindestens 18 Jahre alt *</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-zinc-300">
        <input name="consent" type="checkbox" required className="mt-0.5" />
        <span>
          Ich bin einverstanden, dass meine Angaben zur Bearbeitung der Bewerbung und
          zur Kontaktaufnahme gespeichert werden. *
        </span>
      </label>

      {state === "error" && <p className="text-sm text-red-400">{msg}</p>}
      <button
        disabled={state === "sending"}
        className="w-full rounded-lg bg-fuchsia-700 px-4 py-2.5 font-medium text-white hover:bg-fuchsia-600 disabled:opacity-50"
      >
        {state === "sending" ? "Sende…" : "Bewerbung abschicken"}
      </button>
    </form>
  )
}
