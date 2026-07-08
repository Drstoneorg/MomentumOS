"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { createBooking } from "@/lib/bookingActions"
import { formatPrice } from "@/lib/bookos"
import { btnCls, inputCls } from "@/components/ui"
import type { Tables } from "@/lib/database.types"

type Geo = { label: string; lat: number; lng: number }

export function BookingForm({ treatments }: { treatments: Tables<"treatments">[] }) {
  const router = useRouter()
  const [treatmentId, setTreatmentId] = useState(treatments[0]?.id ?? "")
  const [addr, setAddr] = useState("")
  const [results, setResults] = useState<Geo[]>([])
  const [picked, setPicked] = useState<Geo | null>(null)
  const [when, setWhen] = useState<"now" | "later">("now")
  const [scheduledAt, setScheduledAt] = useState("")
  const [note, setNote] = useState("")
  const [phone, setPhone] = useState("")
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const treatment = treatments.find((t) => t.id === treatmentId)

  function onAddr(v: string) {
    setAddr(v)
    setPicked(null)
    clearTimeout(debounce.current)
    if (v.trim().length < 4) {
      setResults([])
      return
    }
    debounce.current = setTimeout(async () => {
      setSearching(true)
      const res = await fetch(`/api/book/geocode?q=${encodeURIComponent(v)}`)
      const data = await res.json()
      setResults(data.results ?? [])
      setSearching(false)
    }, 500)
  }

  // „Mein Standort" wie bei Uber: GPS → Reverse-Geocoding → Adresse gesetzt
  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Standortdienst nicht verfügbar.")
      return
    }
    setError(null)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const res = await fetch(`/api/book/geocode?lat=${lat}&lng=${lng}`)
          const data = await res.json()
          const hit: Geo | undefined = data.results?.[0]
          const geo: Geo = hit ?? { label: `Aktuelle Position (${lat.toFixed(5)}, ${lng.toFixed(5)})`, lat, lng }
          setPicked(geo)
          setAddr(geo.label)
          setResults([])
        } catch {
          setError("Adresse konnte nicht ermittelt werden.")
        } finally {
          setLocating(false)
        }
      },
      () => {
        setLocating(false)
        setError("Standortfreigabe abgelehnt — bitte Adresse eintippen.")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function submit() {
    setError(null)
    if (!picked) {
      setError("Bitte eine Adresse aus der Liste wählen.")
      return
    }
    if (when === "later" && !scheduledAt) {
      setError("Bitte Wunschtermin angeben.")
      return
    }
    start(async () => {
      try {
        const id = await createBooking({
          treatmentId,
          address: picked.label,
          lat: picked.lat,
          lng: picked.lng,
          scheduledAt: when === "later" ? new Date(scheduledAt).toISOString() : null,
          note,
          phone,
        })
        router.push(`/book/bookings/${id}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fehler")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Treatment</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {treatments.map((t) => (
            <button
              key={t.id}
              onClick={() => setTreatmentId(t.id)}
              className={`rounded-xl border p-3 text-left ${
                treatmentId === t.id ? "border-sky-500 bg-sky-950/30" : "border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">{t.name}</span>
                <span className="text-sky-400">{formatPrice(t.base_price_cents)}</span>
              </div>
              <p className="text-xs text-zinc-500">{t.duration_min} Min · {t.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <label className="mb-1 block text-sm text-zinc-400">Adresse</label>
        <div className="flex gap-2">
          <input
            value={addr}
            onChange={(e) => onAddr(e.target.value)}
            placeholder="Straße, Hausnummer, Stadt"
            className={inputCls}
          />
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            title="Meinen Standort verwenden"
            className="shrink-0 rounded-lg border border-zinc-700 px-3 text-sm text-sky-400 hover:bg-zinc-800 disabled:opacity-50"
          >
            {locating ? "…" : "📍 Standort"}
          </button>
        </div>
        {searching && <p className="mt-1 text-xs text-zinc-500">Suche…</p>}
        {results.length > 0 && !picked && (
          <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 text-sm shadow-xl">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  onClick={() => {
                    setPicked(r)
                    setAddr(r.label)
                    setResults([])
                  }}
                  className="block w-full px-3 py-2 text-left text-zinc-300 hover:bg-zinc-800"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {picked && <p className="mt-1 text-xs text-emerald-400">✓ Adresse erkannt</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm text-zinc-400">Wann</label>
        <div className="flex gap-2">
          <button
            onClick={() => setWhen("now")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              when === "now" ? "border-sky-500 bg-sky-950/30 text-white" : "border-zinc-800 text-zinc-400"
            }`}
          >
            Jetzt (nächster Anbieter)
          </button>
          <button
            onClick={() => setWhen("later")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              when === "later" ? "border-sky-500 bg-sky-950/30 text-white" : "border-zinc-800 text-zinc-400"
            }`}
          >
            Termin planen
          </button>
        </div>
        {when === "later" && (
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className={inputCls + " mt-2"}
          />
        )}
      </div>

      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon (für Rückfragen)" className={inputCls} />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Notiz für den Anbieter (Stockwerk, Wünsche …)" className={inputCls} />

      {treatment && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm">
          <div className="flex justify-between text-zinc-300">
            <span>{treatment.name} · {treatment.duration_min} Min</span>
            <span>{formatPrice(treatment.base_price_cents)}</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">+ Anfahrtspauschale je nach Distanz (0–15 €), Bezahlung nach Abschluss.</p>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={submit} disabled={pending || !picked} className={btnCls + " w-full"}>
        {pending ? "Buche…" : when === "now" ? "Jetzt buchen — Anbieter suchen" : "Termin anfragen"}
      </button>
    </div>
  )
}
