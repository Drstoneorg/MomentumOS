import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui"
import { StyleForm } from "./StyleForm"
import { ExtensionTokenForm } from "./ExtensionTokenForm"
import { TasteProfileForm } from "./TasteProfileForm"
import { PushToggle } from "./PushToggle"
import { AiBudgetForm } from "./AiBudgetForm"
import { monthlyUsage, type UsageSummary } from "@/lib/ai/usage"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const supabase = await createClient()
  const [{ data: style }, { data: extToken }, { data: taste }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "user_style_profile").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "extension_token").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "taste_profile").maybeSingle(),
  ])
  const tasteVal = (taste?.value ?? {}) as { include?: string[]; avoid?: string[]; autoLikeHint?: boolean }

  let usage: UsageSummary | null = null
  try {
    usage = await monthlyUsage(supabase)
  } catch {
    // kein SERVICE_ROLE_KEY lokal — Karte zeigt Hinweis
  }

  const hasDeepseek = !!process.env.DEEPSEEK_API_KEY
  const hasTelegram = !!process.env.TELEGRAM_SESSION
  const hasImage = !!(process.env.OPENAI_API_KEY || process.env.IMAGE_API_KEY)
  const hasPush = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
  const hasStripe = !!process.env.STRIPE_SECRET_KEY

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Einstellungen</h1>

      <Card title="Mein Schreibstil">
        <p className="mb-2 text-sm text-zinc-400">
          Beschreibt, wie der Generator für dich klingt. Beispiele eigener Nachrichten reinkopieren hilft enorm.
        </p>
        <StyleForm current={typeof style?.value === "string" ? style.value : ""} />
      </Card>

      <Card title="Browser-Extension">
        <p className="mb-2 text-sm text-zinc-400">
          MatchOS Companion liest Tinder/Bumble/Boo/WhatsApp-Web/Instagram mit und legt
          Kontakte + Antwortentwürfe an. Installation: siehe README (extension/-Ordner).
        </p>
        <ExtensionTokenForm
          current={typeof extToken?.value === "string" ? extToken.value : ""}
        />
      </Card>

      <Card title="Beuteschema (Typ-Check)">
        <p className="mb-2 text-sm text-zinc-400">
          Stichwörter, auf die die Extension den Profiltext prüft. Bei Treffer zeigt das
          Overlay „Passt zu deinem Typ" plus einen Like-Button, den du selbst drückst.
        </p>
        <TasteProfileForm
          current={{
            include: Array.isArray(tasteVal.include) ? tasteVal.include : [],
            avoid: Array.isArray(tasteVal.avoid) ? tasteVal.avoid : [],
            autoLikeHint: tasteVal.autoLikeHint !== false,
          }}
        />
      </Card>

      <Card title="Push-Benachrichtigungen">
        <p className="mb-2 text-sm text-zinc-400">
          Geburtstage, fällige Follow-ups und Queue-Entwürfe direkt aufs Gerät.
          Auf dem Handy: MatchOS erst „Zum Home-Bildschirm“ hinzufügen (PWA), dann aktivieren.
        </p>
        <PushToggle vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
      </Card>

      <Card title="KI-Verbrauch & Kosten-Limit">
        <p className="mb-2 text-sm text-zinc-400">
          Jeder KI-Call (DeepSeek, Vision, Bilder) wird mit Kostenschätzung geloggt. Bei
          Erreichen des Monatslimits blocken alle KI-Funktionen mit klarer Fehlermeldung.
        </p>
        {usage ? (
          <div className="mb-3 space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span>
                Diesen Monat:{" "}
                <b className={usage.monthCostUsd >= usage.limitUsd ? "text-rose-400" : "text-emerald-400"}>
                  ${usage.monthCostUsd.toFixed(2)}
                </b>{" "}
                von ${usage.limitUsd.toFixed(2)}
              </span>
              <span className="text-zinc-500">
                {Math.min(100, Math.round((usage.monthCostUsd / usage.limitUsd) * 100))}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full ${usage.monthCostUsd >= usage.limitUsd ? "bg-rose-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, (usage.monthCostUsd / usage.limitUsd) * 100)}%` }}
              />
            </div>
            <ul className="text-xs text-zinc-500">
              {Object.entries(usage.byProvider).map(([p, v]) => (
                <li key={p}>
                  {p}: ${v.costUsd.toFixed(3)} · {v.calls} Calls
                </li>
              ))}
              {!Object.keys(usage.byProvider).length && <li>Noch keine KI-Calls diesen Monat.</li>}
            </ul>
          </div>
        ) : (
          <p className="mb-3 text-sm text-amber-400">
            Verbrauch nicht abrufbar — SUPABASE_SERVICE_ROLE_KEY fehlt in dieser Umgebung.
          </p>
        )}
        <AiBudgetForm current={usage?.limitUsd ?? 10} />
      </Card>

      <Card title="API-Status">
        <ul className="space-y-1 text-sm">
          <li className={hasDeepseek ? "text-emerald-400" : "text-amber-400"}>
            {hasDeepseek ? "✓" : "✗"} DeepSeek API {hasDeepseek ? "verbunden" : "— DEEPSEEK_API_KEY in .env.local eintragen"}
          </li>
          <li className={hasTelegram ? "text-emerald-400" : "text-zinc-500"}>
            {hasTelegram ? "✓" : "○"} Telegram {hasTelegram ? "Session vorhanden" : "— optional, siehe README (npm run telegram:login)"}
          </li>
          <li className={hasImage ? "text-emerald-400" : "text-zinc-500"}>
            {hasImage ? "✓" : "○"} Bild-Generierung {hasImage ? "aktiv" : "— OPENAI_API_KEY in Vercel setzen für echte KI-Bilder"}
          </li>
          <li className={hasPush ? "text-emerald-400" : "text-zinc-500"}>
            {hasPush ? "✓" : "○"} Web Push {hasPush ? "aktiv (VAPID gesetzt)" : "— VAPID-Keys fehlen"}
          </li>
          <li className={hasStripe ? "text-emerald-400" : "text-amber-400"}>
            {hasStripe ? "✓" : "○"} BookOS-Zahlung {hasStripe ? "Stripe aktiv" : "— Testmodus (STRIPE_SECRET_KEY für echte Zahlungen)"}
          </li>
        </ul>
      </Card>
    </div>
  )
}
