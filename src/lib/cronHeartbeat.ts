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

export const CRON_NAMES = ["followups", "moments", "dispatch", "digest"] as const
export const CRON_MAX_AGE_HOURS = 36
