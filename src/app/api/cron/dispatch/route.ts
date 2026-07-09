import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { OFFER_TTL_SECONDS, DISPATCH_RADIUS_LIMIT } from "@/lib/bookos"
import { sendPushToAll } from "@/lib/push"
import { beatCron } from "@/lib/cronHeartbeat"

export const maxDuration = 60

// Vorlauf: Terminbuchungen werden so viele Minuten vor scheduled_at angefragt.
const SCHEDULE_LEAD_MIN = 30

/**
 * BookOS-Watchdog (serverseitig, unabhängig von offenen Browsern).
 * 1. Abgelaufene Offers auf `expired` setzen.
 * 2. Hängende Sofort-Buchungen (status=requested, kein Termin, keine lebenden Offers) neu dispatchen.
 * 3. Fällige Terminbuchungen (scheduled_at in < SCHEDULE_LEAD_MIN) erstmalig dispatchen.
 *
 * Schutz: optionaler `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  await beatCron(supabase, "dispatch")
  const nowIso = new Date().toISOString()

  // 1. Abgelaufene, noch offene Offers schließen.
  const { data: expired } = await supabase
    .from("booking_offers")
    .update({ status: "expired" })
    .eq("status", "offered")
    .lt("expires_at", nowIso)
    .select("id")
  const expiredCount = expired?.length ?? 0

  // Kandidaten: alles was noch auf einen Anbieter wartet.
  const leadCutoff = new Date(Date.now() + SCHEDULE_LEAD_MIN * 60_000).toISOString()
  const { data: waiting } = await supabase
    .from("bookings")
    .select("id, scheduled_at")
    .eq("status", "requested")

  const results: { bookingId: string; action: string }[] = []

  for (const b of waiting ?? []) {
    // Terminbuchung, deren Zeitfenster noch nicht erreicht ist → warten.
    if (b.scheduled_at && b.scheduled_at > leadCutoff) continue

    // Läuft noch ein Offer? Dann nichts tun.
    const { count: live } = await supabase
      .from("booking_offers")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", b.id)
      .eq("status", "offered")
      .gt("expires_at", nowIso)
    if ((live ?? 0) > 0) continue

    // Standort holen, Anbieter im Umkreis anfragen.
    const { data: geoRows } = await supabase.rpc("booking_geo", { p_booking: b.id })
    const geo = Array.isArray(geoRows) && geoRows[0] ? geoRows[0] : null
    if (!geo) {
      results.push({ bookingId: b.id, action: "no_geo" })
      continue
    }

    const { data: nearby } = await supabase.rpc("nearby_providers", {
      p_lat: geo.b_lat,
      p_lng: geo.b_lng,
      p_limit: DISPATCH_RADIUS_LIMIT,
    })
    if (!nearby?.length) {
      results.push({ bookingId: b.id, action: "no_providers" })
      continue
    }

    const expiresAt = new Date(Date.now() + OFFER_TTL_SECONDS * 1000).toISOString()
    const rows = nearby.map((p) => ({
      booking_id: b.id,
      provider_id: p.id,
      distance_km: p.distance_km,
      expires_at: expiresAt,
      status: "offered" as const,
    }))
    await supabase.from("booking_offers").upsert(rows, { onConflict: "booking_id,provider_id" })
    results.push({ bookingId: b.id, action: `dispatched_${rows.length}` })
  }

  const dispatched = results.filter((r) => r.action.startsWith("dispatched")).length
  if (dispatched) {
    await sendPushToAll({
      title: "BookOS",
      body: `${dispatched} Buchung(en) an Anbieter weitergeleitet`,
      url: "/provider",
    }).catch(() => {})
  }

  return NextResponse.json({
    expiredOffers: expiredCount,
    waiting: waiting?.length ?? 0,
    dispatched,
    results,
  })
}
