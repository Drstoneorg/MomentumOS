import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const maxDuration = 30

/**
 * Generischer Ticketshop-Webhook: Pretix, Eventbrite & Co. schicken beim Kauf
 * ein JSON — wir fischen alle Gutschein-/Promo-Codes raus und setzen passende
 * event_invites automatisch auf Status "ticket". So schließt sich der Funnel
 * (eingeladen → zugesagt → Ticket) ohne Handarbeit.
 *
 * Auth: ?key=<secret> oder Header X-Webhook-Key. Secret kommt aus den
 * Einstellungen (Karte "Ticket-Webhook") — kein Env-Var nötig.
 * Ohne gesetztes Secret ist die Route deaktiviert (503).
 */

const CODE_KEYS = new Set([
  "voucher",
  "voucher_code",
  "code",
  "promo_code",
  "promocode",
  "discount_code",
  "coupon",
  "coupon_code",
])

// Payload-Formate unterscheiden sich je Shop — deshalb rekursiv alle Felder
// absuchen, deren Name nach Code aussieht, statt ein Schema zu erzwingen.
function collectCodes(value: unknown, out: Set<string>, depth = 0) {
  if (depth > 6 || value == null) return
  if (Array.isArray(value)) {
    for (const v of value) collectCodes(v, out, depth + 1)
    return
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (CODE_KEYS.has(k.toLowerCase()) && typeof v === "string" && v.trim()) {
        out.add(v.trim().toUpperCase())
      } else {
        collectCodes(v, out, depth + 1)
      }
    }
  }
}

export async function POST(req: Request) {
  // Extern erreichbare Route: nie mit 500 + Stacktrace antworten.
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return NextResponse.json({ error: "Webhook nicht konfiguriert" }, { status: 503 })
  }
  const { data: secretRow } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "ticket_webhook_secret")
    .maybeSingle()
  const secret = typeof secretRow?.value === "string" ? secretRow.value.trim() : ""
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook nicht aktiviert — Secret in den Einstellungen generieren" },
      { status: 503 }
    )
  }

  const url = new URL(req.url)
  const provided = url.searchParams.get("key") ?? req.headers.get("x-webhook-key") ?? ""
  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Kein JSON-Body" }, { status: 400 })
  }

  const codes = new Set<string>()
  collectCodes(payload, codes)

  let matched = 0
  if (codes.size) {
    const { data: invites } = await supabase
      .from("event_invites")
      .select("id, promo_code, status")
      .not("promo_code", "is", null)
    for (const inv of invites ?? []) {
      if (!inv.promo_code) continue
      if (!codes.has(inv.promo_code.trim().toUpperCase())) continue
      if (inv.status === "ticket" || inv.status === "attended") continue
      await supabase.from("event_invites").update({ status: "ticket" }).eq("id", inv.id)
      matched++
    }
  }

  // Debug-Spur für die Einstellungen: wann kam der letzte Webhook an, was fand er
  await supabase.from("settings").upsert({
    key: "ticket_webhook_last",
    value: JSON.stringify({
      at: new Date().toISOString(),
      codesFound: codes.size,
      matched,
    }),
    updated_at: new Date().toISOString(),
  })

  return NextResponse.json({ received: true, codesFound: codes.size, matched })
}
