import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Adresse → Koordinaten via OpenStreetMap Nominatim (kostenlos, kein Key).
// Nutzungsrichtlinie: aussagekräftiger User-Agent, moderate Frequenz.
export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const q = new URL(req.url).searchParams.get("q")?.trim()
  if (!q || q.length < 3) return NextResponse.json({ results: [] })

  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=" +
    encodeURIComponent(q)
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MatchOS-BookOS/1.0 (effystone00@icloud.com)" },
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
