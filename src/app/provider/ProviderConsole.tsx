"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useRealtimeRefresh } from "@/components/useRealtimeRefresh"
import {
  setProviderOnline, updateProviderLocation, acceptOffer, declineOffer, advanceBooking,
} from "@/lib/bookingActions"
import { formatPrice, etaMinutes } from "@/lib/bookos"
import { BOOKING_STATUS_LABELS, type Tables } from "@/lib/database.types"
import { btnCls, btnGhostCls } from "@/components/ui"

type OfferRow = {
  id: string
  distance_km: number | null
  expires_at: string
  bookings: (Pick<Tables<"bookings">, "id" | "address" | "price_cents" | "customer_note" | "duration_min"> & {
    treatments: { name: string } | null
  }) | null
}

const NEXT_LABEL: Record<string, string> = {
  accepted: "Losfahren",
  en_route: "Angekommen",
  arrived: "Treatment starten",
  in_progress: "Abschließen",
}

export function ProviderConsole({
  providers,
  activeId,
  offers,
  jobs,
}: {
  providers: Tables<"providers">[]
  activeId: string
  offers: OfferRow[]
  jobs: (Tables<"bookings"> & { treatments: { name: string } | null })[]
}) {
  useRealtimeRefresh("booking_offers")
  useRealtimeRefresh("bookings")
  const router = useRouter()
  const [pending, start] = useTransition()
  const [now, setNow] = useState(() => Date.now())
  const watchRef = useRef<number | null>(null)

  const provider = providers.find((p) => p.id === activeId)!

  // Countdown-Ticker
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Live-Standort senden, solange online (Geolocation-Watch)
  useEffect(() => {
    if (!provider.is_online || !("geolocation" in navigator)) return
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        updateProviderLocation(activeId, pos.coords.latitude, pos.coords.longitude)
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    )
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    }
  }, [provider.is_online, activeId])

  function switchProvider(id: string) {
    const url = new URL(window.location.href)
    url.searchParams.set("as", id)
    router.push(url.pathname + url.search)
  }

  return (
    <div className="space-y-4">
      {/* Anbieter-Wahl (Demo: mehrere Anbieter im System) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-500">Angemeldet als:</span>
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => switchProvider(p.id)}
            className={`rounded-full px-3 py-1 text-sm ${
              p.id === activeId ? "bg-sky-600 text-white" : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Online-Toggle */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div>
          <p className="font-medium text-white">{provider.is_online ? "🟢 Online" : "⚫ Offline"}</p>
          <p className="text-xs text-zinc-500">
            {provider.is_online
              ? "Du empfängst Anfragen. Standort wird live geteilt."
              : "Offline — keine neuen Anfragen."}
          </p>
        </div>
        <button
          onClick={() =>
            start(async () => {
              if (!provider.is_online && "geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition((pos) =>
                  updateProviderLocation(activeId, pos.coords.latitude, pos.coords.longitude)
                )
              }
              await setProviderOnline(activeId, !provider.is_online)
              router.refresh()
            })
          }
          disabled={pending}
          className={provider.is_online ? btnGhostCls : btnCls}
        >
          {provider.is_online ? "Offline gehen" : "Online gehen"}
        </button>
      </div>

      {/* Eingehende Angebote */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-400">Neue Anfragen ({offers.length})</h2>
        {offers.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">
            Keine offenen Anfragen.
          </p>
        ) : (
          <ul className="space-y-2">
            {offers.map((o) => {
              const secsLeft = Math.max(0, Math.round((new Date(o.expires_at).getTime() - now) / 1000))
              const eta = etaMinutes(o.distance_km)
              return (
                <li key={o.id} className="rounded-xl border border-sky-800 bg-sky-950/20 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-white">{o.bookings?.treatments?.name ?? "Treatment"}</p>
                      <p className="text-sm text-zinc-400">📍 {o.bookings?.address}</p>
                      <p className="text-xs text-zinc-500">
                        {o.distance_km} km · ETA ~{eta} Min · {formatPrice(o.bookings?.price_cents ?? 0)}
                      </p>
                      {o.bookings?.customer_note && (
                        <p className="mt-1 text-xs text-zinc-400">„{o.bookings.customer_note}“</p>
                      )}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${secsLeft > 10 ? "bg-sky-900 text-sky-300" : "bg-rose-900 text-rose-300"}`}>
                      {secsLeft}s
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() =>
                        start(async () => {
                          const ok = await acceptOffer(o.id, o.distance_km)
                          if (!ok) alert("Zu spät — Anfrage bereits vergeben.")
                          router.refresh()
                        })
                      }
                      disabled={pending || secsLeft === 0}
                      className={btnCls + " flex-1"}
                    >
                      Annehmen
                    </button>
                    <button
                      onClick={() => start(async () => { await declineOffer(o.id); router.refresh() })}
                      disabled={pending}
                      className={btnGhostCls}
                    >
                      Ablehnen
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Laufende Jobs */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-400">Meine Jobs ({jobs.length})</h2>
        {jobs.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">Keine aktiven Jobs.</p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((j) => (
              <li key={j.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white">{j.treatments?.name ?? "Treatment"}</p>
                  <span className="text-xs text-zinc-400">{BOOKING_STATUS_LABELS[j.status]}</span>
                </div>
                <p className="text-sm text-zinc-400">📍 {j.address}</p>
                {j.contact_phone && <p className="text-xs text-zinc-500">☎ {j.contact_phone}</p>}
                <div className="mt-3 flex gap-2">
                  {NEXT_LABEL[j.status] && (
                    <button
                      onClick={() => start(async () => { await advanceBooking(j.id, j.status); router.refresh() })}
                      disabled={pending}
                      className={btnCls + " flex-1"}
                    >
                      {NEXT_LABEL[j.status]}
                    </button>
                  )}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(j.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className={btnGhostCls}
                  >
                    Navigation ↗
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
