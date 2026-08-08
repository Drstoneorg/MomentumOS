import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { Card } from "@/components/ui"
import { CRON_NAMES, CRON_MAX_AGE_HOURS } from "@/lib/cronHeartbeat"
import { gruppiereFehler } from "@/lib/fehlerGruppen"
import { monthlyUsage } from "@/lib/ai/usage"

export const dynamic = "force-dynamic"

/**
 * Systemstatus auf einer Seite: Crons, KI-Kosten, Fehlergruppen, Tabellen-
 * Größen, Rate-Limit-Buckets. Reine Lese-Seite — die Antwort auf „läuft
 * eigentlich alles?", ohne durch Dashboard, Settings und SQL zu springen.
 */

/** Außerhalb der Komponente wegen react-hooks/purity (Date.now im Render). */
function stundenSeit(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3600_000
}
function tageZurueckIso(tage: number): string {
  return new Date(Date.now() - tage * 86400_000).toISOString()
}

// Die groß werdenden Tabellen — Wachstum hier treibt Storage und Backups
const GROSSE_TABELLEN = [
  "messages",
  "memories",
  "ai_usage",
  "contacts",
  "event_invites",
  "job_applications",
  "paper_trades",
  "client_errors",
  "moment_assets",
  "suggestions",
] as const

export default async function StatusPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null // Middleware leitet ohnehin auf /login

  const [heartbeatsRes, fehlerRes, usage, groessen] = await Promise.all([
    supabase.from("settings").select("key, value").like("key", "cron_heartbeat_%"),
    supabase
      .from("client_errors")
      .select("message, created_at")
      .gte("created_at", tageZurueckIso(7))
      .order("created_at", { ascending: false })
      .limit(300),
    monthlyUsage(supabase),
    Promise.all(
      GROSSE_TABELLEN.map(async (t) => {
        const { count } = await supabase.from(t).select("*", { count: "exact", head: true })
        return { tabelle: t, zeilen: count ?? 0 }
      })
    ),
  ])

  // Rate-Limit-Buckets liest nur die Service-Role (RLS ohne Policy — gewollt)
  let buckets: { bucket: string; count: number; window_start: string }[] = []
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from("rate_limits")
      .select("bucket, count, window_start")
      .gte("window_start", tageZurueckIso(1 / 24))
      .order("count", { ascending: false })
      .limit(10)
    buckets = data ?? []
  } catch {
    /* ohne Service-Key bleibt die Karte leer */
  }

  const beats = new Map(
    (heartbeatsRes.data ?? []).map((r) => [r.key.replace("cron_heartbeat_", ""), String(r.value)])
  )
  const cronZeilen = CRON_NAMES.map((name) => {
    const last = beats.get(name)
    const maxH = name === "trading" ? 100 : CRON_MAX_AGE_HOURS
    const alterH = last ? stundenSeit(last) : null
    return {
      name,
      alterH,
      ok: alterH !== null && alterH <= maxH,
    }
  })

  const fehlerGruppen = gruppiereFehler(fehlerRes.data ?? []).slice(0, 8)
  const sortierteGroessen = [...groessen].sort((a, b) => b.zeilen - a.zeilen)
  const budgetAnteil = usage.limitUsd > 0 ? usage.monthCostUsd / usage.limitUsd : 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">🩺 Systemstatus</h1>
        <p className="text-sm text-zinc-400">
          Alles Betriebliche auf einen Blick — Crons, Kosten, Fehler, Wachstum. Backups laufen
          außerhalb der App (GitHub Actions → &bdquo;DB Backup&ldquo;).
        </p>
      </div>

      <Card title="⚙️ Crons (Heartbeats)">
        <ul className="space-y-1.5 text-sm">
          {cronZeilen.map((c) => (
            <li key={c.name} className="flex items-center justify-between">
              <span className="font-mono">{c.name}</span>
              <span className={c.ok ? "text-emerald-400" : "text-rose-400"}>
                {c.alterH === null
                  ? "✖ noch nie gelaufen"
                  : `${c.ok ? "✓" : "✖"} vor ${Math.round(c.alterH)} h`}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-zinc-500">
          Rot = länger als {CRON_MAX_AGE_HOURS} h still (trading: 100 h, läuft nur werktags).
          Der Wochen-Digest (So 17:00) hat keinen Heartbeat.
        </p>
      </Card>

      <Card title="💸 KI-Kosten diesen Monat">
        <p className="text-sm">
          <b className={budgetAnteil >= 1 ? "text-rose-400" : budgetAnteil >= 0.8 ? "text-amber-300" : "text-emerald-400"}>
            ${usage.monthCostUsd.toFixed(2)}
          </b>{" "}
          von ${usage.limitUsd.toFixed(2)} ({Math.round(budgetAnteil * 100)} %)
        </p>
        {usage.byFeature.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            {usage.byFeature.slice(0, 8).map((f) => (
              <li key={f.feature} className="flex justify-between gap-3">
                <span className="truncate">{f.label}</span>
                <span className="shrink-0 font-mono text-zinc-400">
                  ${f.costUsd.toFixed(2)} · {f.calls}×
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="🐞 Fehlergruppen (7 Tage)">
        {fehlerGruppen.length === 0 ? (
          <p className="text-sm text-zinc-500">Keine Browser-Fehler gemeldet ✓</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {fehlerGruppen.map((g) => (
              <li key={g.muster} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-zinc-300" title={g.muster}>
                  {g.muster}
                </span>
                <span className="shrink-0 font-mono text-zinc-400">{g.anzahl}×</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="🗄 Tabellen-Wachstum">
        <ul className="space-y-1 text-sm">
          {sortierteGroessen.map((g) => (
            <li key={g.tabelle} className="flex justify-between">
              <span className="font-mono text-zinc-300">{g.tabelle}</span>
              <span className="font-mono text-zinc-400">{g.zeilen.toLocaleString("de-DE")}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="🚦 Rate-Limit-Buckets (letzte Stunde)">
        {buckets.length === 0 ? (
          <p className="text-sm text-zinc-500">Keine aktiven Buckets</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {buckets.map((b) => (
              <li key={b.bucket} className="flex justify-between">
                <span className="font-mono text-zinc-300">{b.bucket}</span>
                <span className="font-mono text-zinc-400">{b.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
