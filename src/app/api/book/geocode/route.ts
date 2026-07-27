import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Adresse → Koordinaten via OpenStreetMap Nominatim (kostenlos, kein Key).
// Nutzungsrichtlinie: aussagekräftiger User-Agent, moderate Frequenz.
// Kontaktadresse per Env-Var, damit im öffentlichen Repo keine private Mail steht.
const USER_AGENT = `MomentumOS-BookOS/1.0 (${process.env.CONTACT_EMAIL || "noreply@example.com"})`
export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const params = new URL(req.url).searchParams

  // Reverse-Geocoding: lat/lng → Adresse (für „Mein Standort")
  const lat = params.get("lat")
  const lng = params.get("lng")
  if (lat && lng) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
        { headers: { "User-Agent": USER_AGENT } }
      )
      if (!res.ok) return NextResponse.json({ results: [] })
      const r = (await res.json()) as { display_name?: string }
      return NextResponse.json({
        results: r.display_name
          ? [{ label: r.display_name, lat: Number(lat), lng: Number(lng) }]
          : [],
      })
    } catch {
      return NextResponse.json({ results: [] })
    }
  }

  const q = params.get("q")?.trim()
  if (!q || q.length < 3) return NextResponse.json({ results: [] })

  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=" +
    encodeURIComponent(q)
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    })
    if (!res.ok) return NextResponse.json({ results: [] })
    const data = (await res.json()) as Array<{
      display_name: string
      lat: string
      lon: string
    }>
    return NextResponse.json({
      results: data.map((r) => ({
        label: r.display_name,
        lat: Number(r.lat),
        lng: Number(r.lon),
      })),
    })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
