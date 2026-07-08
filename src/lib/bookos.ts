import type { Enums } from "@/lib/database.types"

export const OFFER_TTL_SECONDS = Number(process.env.BOOKOS_OFFER_TTL ?? 45)
export const DISPATCH_RADIUS_LIMIT = 12 // max Anbieter pro Runde

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })
}

// Gestaffelte Anfahrtspauschale nach Distanz.
export function travelFeeCents(distanceKm: number | null | undefined): number {
  if (!distanceKm || distanceKm <= 3) return 0
  if (distanceKm <= 7) return 500
  if (distanceKm <= 12) return 900
  return 1500
}

export function totalCents(basePriceCents: number, travelCents: number): number {
  return basePriceCents + travelCents
}

// Grobe ETA aus Distanz (Stadtverkehr ~22 km/h) + 3 min Vorlauf.
export function etaMinutes(distanceKm: number | null | undefined): number | null {
  if (distanceKm == null) return null
  return Math.max(2, Math.round((distanceKm / 22) * 60) + 3)
}

const ACTIVE: Enums<"booking_status">[] = [
  "requested", "accepted", "en_route", "arrived", "in_progress",
]
export function isActiveBooking(status: Enums<"booking_status">): boolean {
  return ACTIVE.includes(status)
}

export const STATUS_COLOR: Record<Enums<"booking_status">, string> = {
  requested: "bg-amber-500",
  accepted: "bg-sky-500",
  en_route: "bg-sky-500",
  arrived: "bg-indigo-500",
  in_progress: "bg-violet-500",
  completed: "bg-emerald-500",
  cancelled: "bg-zinc-600",
}
