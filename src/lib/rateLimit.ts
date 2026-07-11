import { createAdminClient } from "@/lib/supabase/admin"

/**
 * DB-basiertes Stunden-Fenster-Limit pro Bucket — überlebt Serverless-Kaltstarts.
 * Schutzziel: geleakter Extension-Token darf nicht unbegrenzt KI-Kosten erzeugen.
 * Single-User-App: Race-Conditions bei der Zählung sind verschmerzbar.
 */
export async function rateLimitOk(
  bucket: string,
  limit: number,
  windowMinutes = 60
): Promise<boolean> {
  const admin = createAdminClient()
  const now = Date.now()
  const { data } = await admin.from("rate_limits").select("*").eq("bucket", bucket).maybeSingle()

  if (!data || now - new Date(data.window_start).getTime() >= windowMinutes * 60_000) {
    await admin
      .from("rate_limits")
      .upsert({ bucket, window_start: new Date(now).toISOString(), count: 1 })
    return true
  }
  if (data.count >= limit) return false
  await admin.from("rate_limits").update({ count: data.count + 1 }).eq("bucket", bucket)
  return true
}
