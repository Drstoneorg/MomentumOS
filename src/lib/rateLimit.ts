import { createAdminClient } from "@/lib/supabase/admin"

/**
 * DB-basiertes Stunden-Fenster-Limit pro Bucket — überlebt Serverless-Kaltstarts.
 * Schutzziel: geleakter Extension-Token darf nicht unbegrenzt KI-Kosten erzeugen.
 * Zählung läuft atomar in der DB (RPC bump_rate_limit: Upsert mit Fenster-Reset
 * und Inkrement in einem Statement) — parallele Requests können sich nicht mehr
 * am Limit vorbeizählen.
 */
export async function rateLimitOk(
  bucket: string,
  limit: number,
  windowMinutes = 60
): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("bump_rate_limit", {
    p_bucket: bucket,
    p_limit: limit,
    p_window_minutes: windowMinutes,
  })
  // Fail-open wie zuvor: ein DB-Schluckauf darf legitime Nutzer nicht aussperren —
  // das Limit ist Kostenschutz, keine Auth.
  if (error) return true
  return data === true
}
