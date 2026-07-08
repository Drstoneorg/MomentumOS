// KI-Verbrauchs-Tracking + Monats-Budget. Jeder KI-Call loggt Tokens/Bilder mit
// Kostenschätzung in ai_usage; vor dem Call prüft assertBudget() das Monatslimit
// (settings-Key "ai_budget"). Logging-Fehler brechen nie den eigentlichen Call ab.

import { createAdminClient } from "@/lib/supabase/admin"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

type Db = SupabaseClient<Database>

// Preise USD pro 1M Tokens (Stand 2026-07, Schätzwerte — lieber leicht zu hoch)
const PRICES: Record<string, { in: number; out: number }> = {
  "deepseek-chat": { in: 0.27, out: 1.1 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
}
const IMAGE_PRICE_USD = 0.05 // gpt-image-1, 1024er, konservativ

export const DEFAULT_MONTHLY_LIMIT_USD = 10

export type UsageEntry = {
  provider: "deepseek" | "openai"
  model: string
  feature: string
  tokensIn?: number
  tokensOut?: number
  images?: number
}

export function estimateCost(e: UsageEntry): number {
  const p = PRICES[e.model] ?? { in: 1, out: 3 } // unbekanntes Modell: konservativ
  const tokens = ((e.tokensIn ?? 0) * p.in + (e.tokensOut ?? 0) * p.out) / 1_000_000
  return tokens + (e.images ?? 0) * IMAGE_PRICE_USD
}

function monthStart(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

// Admin-Client bevorzugt (Cron/Prod); lokal ohne SERVICE_ROLE_KEY fällt er auf den
// Cookie-Client des laufenden Requests zurück (RLS-Policy erlaubt authenticated).
async function anyDb(): Promise<Db> {
  try {
    return createAdminClient()
  } catch {
    const { createClient } = await import("@/lib/supabase/server")
    return (await createClient()) as unknown as Db
  }
}

/** Loggt einen KI-Call. Wirft nie. */
export async function logUsage(e: UsageEntry): Promise<void> {
  try {
    const admin = await anyDb()
    await admin.from("ai_usage").insert({
      provider: e.provider,
      model: e.model,
      feature: e.feature,
      tokens_in: e.tokensIn ?? 0,
      tokens_out: e.tokensOut ?? 0,
      images: e.images ?? 0,
      cost_usd: estimateCost(e),
    })
  } catch {
    // Tracking darf Feature nie brechen
  }
}

export type UsageSummary = {
  monthCostUsd: number
  limitUsd: number
  byProvider: Record<string, { costUsd: number; calls: number }>
}

export async function monthlyUsage(client?: Db): Promise<UsageSummary> {
  const db = client ?? (await anyDb())
  const [{ data: rows }, { data: budget }] = await Promise.all([
    db.from("ai_usage").select("provider, cost_usd").gte("created_at", monthStart()),
    db.from("settings").select("value").eq("key", "ai_budget").maybeSingle(),
  ])
  const byProvider: UsageSummary["byProvider"] = {}
  let total = 0
  for (const r of rows ?? []) {
    total += Number(r.cost_usd)
    const p = (byProvider[r.provider] ??= { costUsd: 0, calls: 0 })
    p.costUsd += Number(r.cost_usd)
    p.calls += 1
  }
  const limit = Number((budget?.value as { monthlyLimitUsd?: number } | null)?.monthlyLimitUsd)
  return {
    monthCostUsd: total,
    limitUsd: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_MONTHLY_LIMIT_USD,
    byProvider,
  }
}

/** Wirft, wenn Monatsverbrauch über Limit. Bei Tracking-Fehlern: durchlassen. */
export async function assertBudget(): Promise<void> {
  let u: UsageSummary
  try {
    u = await monthlyUsage()
  } catch {
    return // kein Admin-Key o.ä. — Feature nicht blockieren
  }
  if (u.monthCostUsd >= u.limitUsd) {
    throw new Error(
      `KI-Budget erreicht: $${u.monthCostUsd.toFixed(2)} von $${u.limitUsd.toFixed(2)} diesen Monat. Limit in Einstellungen erhöhen.`
    )
  }
}
