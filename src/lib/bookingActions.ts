"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { OFFER_TTL_SECONDS, DISPATCH_RADIUS_LIMIT, travelFeeCents, totalCents } from "@/lib/bookos"
import { authorizePayment, capturePayment, refundPayment, stripeAvailable } from "@/lib/stripe"

async function db() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Nicht angemeldet")
  return supabase
}

export type CreateBookingInput = {
  treatmentId: string
  address: string
  lat: number
  lng: number
  scheduledAt: string | null
  note?: string
  phone?: string
}

// Legt Buchung an, setzt Geo-Location, startet Dispatch-Runde (Sofort-Buchungen).
export async function createBooking(input: CreateBookingInput): Promise<string> {
  const supabase = await db()

  const { data: treatment } = await supabase
    .from("treatments")
    .select("*")
    .eq("id", input.treatmentId)
    .single()
  if (!treatment) throw new Error("Treatment nicht gefunden")

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      treatment_id: input.treatmentId,
      address: input.address,
      scheduled_at: input.scheduledAt,
      duration_min: treatment.duration_min,
      price_cents: treatment.base_price_cents,
      customer_note: input.note || null,
      contact_phone: input.phone || null,
      status: "requested",
    })
    .select("id")
    .single()
  if (error || !booking) throw new Error(error?.message ?? "Buchung fehlgeschlagen")

  await supabase.rpc("set_booking_location", {
    p_booking: booking.id,
    p_lat: input.lat,
    p_lng: input.lng,
  })

  // Sofort-Buchung → gleich Anbieter anfragen. Terminbuchung → Dispatch später.
  if (!input.scheduledAt) {
    await dispatchBooking(booking.id, input.lat, input.lng)
  }

  revalidatePath("/book")
  revalidatePath("/book/bookings")
  revalidatePath("/provider")
  return booking.id
}

// Erstellt Offers für die nächsten Online-Anbieter im Umkreis.
export async function dispatchBooking(bookingId: string, lat: number, lng: number) {
  const supabase = await db()
  const { data: nearby } = await supabase.rpc("nearby_providers", {
    p_lat: lat,
    p_lng: lng,
    p_limit: DISPATCH_RADIUS_LIMIT,
  })
  if (!nearby?.length) return { offers: 0 }

  const expiresAt = new Date(Date.now() + OFFER_TTL_SECONDS * 1000).toISOString()
  const rows = nearby.map((p) => ({
    booking_id: bookingId,
    provider_id: p.id,
    distance_km: p.distance_km,
    expires_at: expiresAt,
    status: "offered" as const,
  }))
  // Bereits vorhandene (abgelaufene) Offers derselben Anbieter reaktivieren
  await supabase.from("booking_offers").upsert(rows, { onConflict: "booking_id,provider_id" })
  revalidatePath("/provider")
  return { offers: rows.length }
}

// Anbieter nimmt an — atomar, erster gewinnt. Setzt Anfahrtspauschale.
export async function acceptOffer(offerId: string, distanceKm: number | null) {
  const supabase = await db()
  const travel = travelFeeCents(distanceKm)
  const { data: ok, error } = await supabase.rpc("accept_offer", {
    p_offer: offerId,
    p_travel_fee_cents: travel,
  })
  if (error) throw new Error(error.message)

  // Zahlung autorisieren, sobald Anbieter feststeht (nur wenn Stripe konfiguriert).
  if (ok && stripeAvailable()) {
    const { data: b } = await supabase
      .from("booking_offers")
      .select("booking_id, bookings(price_cents)")
      .eq("id", offerId)
      .single()
    const bookingId = b?.booking_id
    const price = b?.bookings?.price_cents ?? 0
    if (bookingId) {
      try {
        const intent = await authorizePayment(totalCents(price, travel), bookingId)
        if (intent) {
          await supabase
            .from("bookings")
            .update({ payment_intent_id: intent.id, payment_status: "authorized" })
            .eq("id", bookingId)
        }
      } catch (e) {
        console.error("Stripe-Autorisierung fehlgeschlagen:", e)
      }
    }
  }
  revalidatePath("/provider")
  revalidatePath("/book/bookings")
  return ok as boolean
}

export async function declineOffer(offerId: string) {
  const supabase = await db()
  await supabase.from("booking_offers").update({ status: "declined" }).eq("id", offerId)
  revalidatePath("/provider")
}

const NEXT_STATUS: Record<string, string> = {
  accepted: "en_route",
  en_route: "arrived",
  arrived: "in_progress",
  in_progress: "completed",
}

// Anbieter schiebt Buchung durch die Status-Maschine.
export async function advanceBooking(bookingId: string, current: string) {
  const supabase = await db()
  const next = NEXT_STATUS[current] as
    | "en_route" | "arrived" | "in_progress" | "completed" | undefined
  if (!next) return
  const patch: import("@/lib/database.types").TablesUpdate<"bookings"> = { status: next }
  if (next === "en_route") patch.accepted_at = new Date().toISOString()
  if (next === "in_progress") patch.started_at = new Date().toISOString()
  if (next === "completed") {
    patch.completed_at = new Date().toISOString()
    const { data: b } = await supabase
      .from("bookings")
      .select("payment_intent_id, payment_status")
      .eq("id", bookingId)
      .single()
    if (b?.payment_intent_id && stripeAvailable()) {
      try {
        await capturePayment(b.payment_intent_id)
        patch.payment_status = "paid"
      } catch (e) {
        console.error("Stripe-Capture fehlgeschlagen:", e)
      }
    } else if (b && !b.payment_intent_id) {
      // Kein Stripe konfiguriert → Testmodus
      patch.payment_status = "test"
    }
  }
  await supabase.from("bookings").update(patch).eq("id", bookingId)
  revalidatePath("/provider")
  revalidatePath("/book/bookings")
}

export async function cancelBooking(bookingId: string, reason?: string) {
  const supabase = await db()
  // Autorisierte, noch nicht eingezogene Zahlung zurückgeben
  if (stripeAvailable()) {
    const { data: b } = await supabase
      .from("bookings")
      .select("payment_intent_id, payment_status")
      .eq("id", bookingId)
      .single()
    if (b?.payment_intent_id && b.payment_status === "authorized") {
      await refundPayment(b.payment_intent_id).catch(() => {})
    }
  }
  await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: reason || null })
    .eq("id", bookingId)
  await supabase.from("booking_offers").update({ status: "expired" }).eq("booking_id", bookingId).eq("status", "offered")
  revalidatePath("/book/bookings")
  revalidatePath("/provider")
}

export async function submitReview(bookingId: string, rating: number, comment?: string) {
  const supabase = await db()
  await supabase.rpc("submit_review", { p_booking: bookingId, p_rating: rating, p_comment: comment })
  revalidatePath("/book/bookings")
}

// Anbieter online/offline + Position aktualisieren
export async function setProviderOnline(providerId: string, online: boolean) {
  const supabase = await db()
  await supabase
    .from("providers")
    .update({ is_online: online, last_seen: new Date().toISOString() })
    .eq("id", providerId)
  revalidatePath("/provider")
}

export async function updateProviderLocation(providerId: string, lat: number, lng: number) {
  const supabase = await db()
  await supabase.rpc("set_provider_location", { p_provider: providerId, p_lat: lat, p_lng: lng })
}
