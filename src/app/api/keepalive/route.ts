import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * Keepalive gegen Supabase-Free-Tier-Pause (7 Tage ohne API-Aktivität).
 * Öffentlich und harmlos: anon-Query auf settings — RLS liefert leeres
 * Ergebnis, aber der REST-Request zählt als Projekt-Aktivität.
 * Wird täglich von GitHub Actions gepingt (.github/workflows/supabase-keepalive.yml).
 */
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { error } = await supabase.from("settings").select("key").limit(1)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() })
}
