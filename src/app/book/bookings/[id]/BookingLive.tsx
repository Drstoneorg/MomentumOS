"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LiveMap } from "@/components/LiveMap"
import { useRealtimeRefresh } from "@/components/useRealtimeRefresh"
import { cancelBooking, submitReview } from "@/lib/bookingActions"
import { BOOKING_STATUS_LABELS, BOOKING_FLOW, type Tables } from "@/lib/database.types"
import { formatPrice, totalCents, etaMinutes, STATUS_COLOR, isActiveBooking } from "@/lib/bookos"
import { btnCls, btnGhostCls } from "@/components/ui"

type Geo = { b_lat: number; b_lng: number; p_lat: number | null; p_lng: number | null; distance_km: number | null }

export function BookingLive({
  booking,
  treatmentName,
  provider,
  geo,
  hasReview,
}: {
  booking: Tables<"bookings">
  treatmentName: string
  provider: Pick<Tables<"providers">, "name" | "rating_avg" | "rating_count" | "bio"> | null
  geo: Geo | null
  hasReview: boolean
}) {
  useRealtimeRefresh("bookings")
  const router = useRouter()
  const [pending, start] = useTransition()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")

  const flowIdx = BOOKING_FLOW.indexOf(booking.status)
  const eta = etaMinutes(geo?.distance_km)
  const markers = geo
    ? [
        { lat: geo.b_lat, lng: geo.b_lng, label: "Dein Standort", kind: "customer" as const },
        ...(geo.p_lat && geo.p_lng
          ? [{ lat: geo.p_lat, lng: geo.p_lng, label: provider?.name ?? "Anbieter", kind: "provider" as const }]
          : []),
      ]
    : []

  return (
    <div className="space-y-4">
      {/* Status-Fortschritt */}
      {booking.status !== "cancelled" ? (
        <div className="flex items-center gap-1">
          {BOOKING_FLOW.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col items-center gap-1">
              <div className={`h-1.5 w-full rounded-full ${i <= flowIdx ? STATUS_COLOR[booking.status] : "bg-zinc-800"}`} />
              <span className={`text-[9px] ${i <= flowIdx ? "text-zinc-300" : "text-zinc-600"}`}>
                {BOOKING_STATUS_LABELS[s]}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-400">
          Storniert{booking.cancel_reason ? ` — ${booking.cancel_reason}` : ""}
        </div>
      )}

      {/* Aktueller Status groß */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_COLOR[booking.status]} ${isActiveBooking(booking.status) ? "animate-pulse" : ""}`} />
          <span className="font-semibold text-white">{BOOKING_STATUS_LABELS[booking.status]}</span>
          {eta != null && (booking.status === "accepted" || booking.status === "en_route") && (
            <span className="ml-auto text-sm text-sky-400">ETA ~{eta} Min · {geo?.distance_km} km</span>
          )}
        </div>
        {booking.status === "requested" && (
          <p className="mt-2 text-sm text-zinc-400">Wir fragen die nächsten verfügbaren Anbieter an …</p>
        )}
      </div>

      {markers.length > 0 && <LiveMap markers={markers} />}

      {/* Anbieter */}
      {provider && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Dein Anbieter</p>
          <p className="font-medium text-white">{provider.name}</p>
          {provider.rating_count > 0 && (
            <p className="text-sm text-amber-400">★ {provider.rating_avg} ({provider.rating_count})</p>
          )}
          {provider.bio && <p className="mt-1 text-sm text-zinc-400">{provider.bio}</p>}
        </div>
      )}

      {/* Rechnung */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
        <div className="flex justify-between text-zinc-300">
          <span>{treatmentName} · {booking.duration_min} Min</span>
          <span>{formatPrice(booking.price_cents)}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Anfahrt</span>
          <span>{booking.travel_fee_cents ? formatPrice(booking.travel_fee_cents) : "—"}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-zinc-800 pt-1 font-semibold text-white">
          <span>Gesamt</span>
          <span>{formatPrice(totalCents(booking.price_cents, booking.travel_fee_cents))}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {booking.payment_status === "test"
            ? "✓ Testzahlung verbucht"
            : booking.payment_status === "paid"
              ? "✓ Bezahlt"
              : "Zahlung nach Abschluss"}
        </p>
      </div>

      <p className="text-sm text-zinc-400">📍 {booking.address}</p>

      {/* Aktionen */}
      {isActiveBooking(booking.status) && (
        <button
          onClick={() =>
            start(async () => {
              await cancelBooking(booking.id, "vom Kunden storniert")
              router.refresh()
            })
          }
          disabled={pending}
          className={btnGhostCls + " w-full"}
        >
          Buchung stornieren
        </button>
      )}

      {/* Bewertung nach Abschluss */}
      {booking.status === "completed" && !hasReview && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-2 font-medium text-white">Wie war dein Treatment?</p>
          <div className="mb-2 flex gap-1 text-2xl">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} className={n <= rating ? "text-amber-400" : "text-zinc-700"}>
                ★
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Kommentar (optional)"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          <button
            onClick={() =>
              start(async () => {
                await submitReview(booking.id, rating, comment)
                router.refresh()
              })
            }
            disabled={pending}
            className={btnCls + " mt-2 w-full"}
          >
            Bewertung abschicken
          </button>
        </div>
      )}
      {booking.status === "completed" && hasReview && (
        <p className="text-center text-sm text-emerald-400">✓ Danke für deine Bewertung!</p>
      )}
    </div>
  )
}
