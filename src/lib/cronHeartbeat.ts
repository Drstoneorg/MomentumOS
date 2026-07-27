import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

/**
 * Cron-Heartbeat: jeder Cron-Lauf schreibt seinen Zeitstempel in settings.
 * Das Dashboard warnt, wenn ein Cron zu lange nicht gelaufen ist — so fällt
 * sofort auf, wenn Vercel-Crons (Hobby-Limit) nicht feuern.
 */
export async function beatCron(
  supabase: SupabaseClient<Database>,
  name: string
): Promise<void> {
  await supabase
    .from("settings")
    .upsert({ key: `cron_heartbeat_${name}`, value: new Date().toISOString() }, { onConflict: "key" })
}

export const CRON_NAMES = ["followups", "moments", "dispatch", "digest", "jobscan", "trading"] as const
export const CRON_MAX_AGE_HOURS = 36

/**
 * Cron-Auth: `Authorization: Bearer <CRON_SECRET>`. Vercel-Cron setzt den Header
 * automatisch, wenn CRON_SECRET als Env-Var gesetzt ist.
 *
 * Fail-closed: fehlt CRON_SECRET, antwortet die Route 503 statt ungeschützt zu
 * laufen. Crons schreiben mit Service-Role-Rechten und lösen KI-Kosten aus —
 * eine vergessene Env-Var darf sie nicht für jeden auslösbar machen.
 *
 * @returns null wenn autorisiert, sonst die Fehlerantwort.
 */
export function cronAuthError(req: Request): Response | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json({ error: "CRON_SECRET fehlt" }, { status: 503 })
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }
  return null
}
