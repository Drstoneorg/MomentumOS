import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimitOk } from "@/lib/rateLimit"

// Aufrufe pro Stunde und Route — teure KI-Routen knapper als billige Sync-Routen.
// Schutz bei Token-Leak: Fremde können nicht unbegrenzt DeepSeek/Vision-Kosten erzeugen.
const HOURLY_LIMITS: Record<string, number> = {
  "/api/extension/replies": 60,
  "/api/extension/rephrase": 60,
  "/api/extension/photo": 30,
  "/api/extension/job": 60,
  "/api/extension/sync": 240,
  "/api/extension/activity": 240,
  "/api/extension/feedback": 240,
  "/api/extension/taste-profile": 240,
}

/**
 * Extension-Auth: Bearer-Token wird gegen settings.extension_token geprüft.
 * Gibt bei Erfolg den Admin-Client zurück (Extension hat keine Browser-Session),
 * bei überschrittenem Stunden-Limit "rate_limited" (Route antwortet dann 429).
 */
export async function authExtension(req: Request) {
  const auth = req.headers.get("authorization")
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "extension_token")
    .maybeSingle()

  const stored = typeof data?.value === "string" ? data.value : null
  if (!stored || stored.length < 20 || stored !== token) return null

  const path = new URL(req.url).pathname
  if (!(await rateLimitOk(`ext:${path}`, HOURLY_LIMITS[path] ?? 120))) {
    return "rate_limited" as const
  }
  return supabase
}
