// KI-Verbrauchs-Tracking + Monats-Budget. Jeder KI-Call loggt Tokens/Bilder mit
// Kostenschätzung in ai_usage; vor dem Call prüft assertBudget() das Monatslimit
// (settings-Key "ai_budget"). Logging-Fehler brechen nie den eigentlichen Call ab.

import { createAdminClient } from "@/lib/supabase/admin"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

type Db = SupabaseClient<Database>

// Preise USD pro 1M Tokens (Stand 2026-07). gpt-image-1 rechnet über Tokens:
// Text-Input $5/1M, Bild-Output $40/1M — daher hier als in/out-Preis modelliert
// (tokensIn = Text-Input, tokensOut = Bild-Output-Tokens).
const PRICES: Record<string, { in: number; out: number }> = {
  "deepseek-chat": { in: 0.27, out: 1.1 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-image-1": { in: 5, out: 40 },
}
const IMAGE_FALLBACK_USD = 0.25 // nur wenn ein unbekanntes Bildmodell ohne Tokens loggt

// Bild-Output-Tokens von gpt-image-1 nach Größe × Qualität (OpenAI-Tabelle).
// Dienen als Fallback, falls die API kein usage-Objekt liefert.
export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024"
export type ImageQuality = "low" | "medium" | "high"
const IMAGE_OUTPUT_TOKENS: Record<ImageSize, Record<ImageQuality, number>> = {
  "1024x1024": { low: 272, medium: 1056, high: 4160 },
  "1024x1536": { low: 408, medium: 1584, high: 6240 },
  "1536x1024": { low: 400, medium: 1568, high: 6208 },
}

export function imageOutputTokens(size: ImageSize, quality: ImageQuality): number {
  return IMAGE_OUTPUT_TOKENS[size]?.[quality] ?? IMAGE_OUTPUT_TOKENS["1024x1024"].high
}

/** Grobe Vorab-Kostenschätzung eines Bildes (für UI-Hinweise). */
export function estimateImageCost(size: ImageSize, quality: ImageQuality): number {
  return (imageOutputTokens(size, quality) * PRICES["gpt-image-1"].out) / 1_000_000
}

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
  const p = PRICES[e.model]
  if (p) {
    return ((e.tokensIn ?? 0) * p.in + (e.tokensOut ?? 0) * p.out) / 1_000_000
  }
  // unbekanntes Modell: Tokens konservativ + Pauschale pro Bild
  const tokens = ((e.tokensIn ?? 0) * 1 + (e.tokensOut ?? 0) * 3) / 1_000_000
  return tokens + (e.images ?? 0) * IMAGE_FALLBACK_USD
}

// Feature-Slug → menschenlesbares Label für die Verbrauchs-Aufschlüsselung.
export const FEATURE_LABELS: Record<string, string> = {
  replies: "Antwortvorschläge",
  summarize: "Zusammenfassungen",
  analyze_stage: "Pipeline-Analyse",
  extract_profile: "Profil-Extraktion",
  moment_message: "Moments-Texte",
  image_prompt: "Bild-Prompts",
  image: "Bild-Generierung",
  vision: "Foto-Check",
  chat: "Sonstige KI",
}
export function featureLabel(f: string): string {
  return FEATURE_LABELS[f] ?? f
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

export type UsageBucket = { costUsd: number; calls: number; images: number }
export type FeatureBucket = UsageBucket & { feature: string; label: string }
export type UsageSummary = {
  monthCostUsd: number
  limitUsd: number
  byProvider: Record<string, UsageBucket>
  byFeature: FeatureBucket[] // absteigend nach Kosten sortiert
}

export async function monthlyUsage(client?: Db): Promise<UsageSummary> {
  const db = client ?? (await anyDb())
  const [{ data: rows }, { data: budget }] = await Promise.all([
    db.from("ai_usage").select("provider, feature, images, cost_usd").gte("created_at", monthStart()),
    db.from("settings").select("value").eq("key", "ai_budget").maybeSingle(),
  ])
  const byProvider: Record<string, UsageBucket> = {}
  const featureMap: Record<string, FeatureBucket> = {}
  let total = 0
  for (const r of rows ?? []) {
    const cost = Number(r.cost_usd)
    total += cost
    const p = (byProvider[r.provider] ??= { costUsd: 0, calls: 0, images: 0 })
    p.costUsd += cost
    p.calls += 1
    p.images += r.images ?? 0
    const f = (featureMap[r.feature] ??= {
      feature: r.feature,
      label: featureLabel(r.feature),
      costUsd: 0,
      calls: 0,
      images: 0,
    })
    f.costUsd += cost
    f.calls += 1
    f.images += r.images ?? 0
  }
  const limit = Number((budget?.value as { monthlyLimitUsd?: number } | null)?.monthlyLimitUsd)
  return {
    monthCostUsd: total,
    limitUsd: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_MONTHLY_LIMIT_USD,
    byProvider,
    byFeature: Object.values(featureMap).sort((a, b) => b.costUsd - a.costUsd),
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
