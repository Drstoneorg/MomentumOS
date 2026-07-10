import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui"
import { StyleForm } from "./StyleForm"
import { StyleRulesForm } from "./StyleRulesForm"
import { StyleLearnCard } from "./StyleLearnCard"
import { ExtensionTokenForm } from "./ExtensionTokenForm"
import { TasteProfileForm } from "./TasteProfileForm"
import { PushToggle } from "./PushToggle"
import { AiBudgetForm } from "./AiBudgetForm"
import { monthlyUsage, type UsageSummary } from "@/lib/ai/usage"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const supabase = await createClient()
  const [{ data: style }, { data: styleRules }, { data: learnedStyle }, { data: extToken }, { data: taste }, { data: fbRows }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "user_style_profile").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "user_style_rules").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "learned_style").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "extension_token").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "taste_profile").maybeSingle(),
    supabase.from("reply_feedback").select("style, rating, content, created_at").order("created_at", { ascending: false }).limit(500),
  ])

  // Daumen-Auswertung: pro Stil hoch/runter + zuletzt bewertete Beispiele
  const fb = fbRows ?? []
  const fbByStyle = new Map<string, { up: number; down: number }>()
  for (const f of fb) {
    const key = f.style ?? "ohne Stil"
    const s = fbByStyle.get(key) ?? { up: 0, down: 0 }
    if (f.rating === 1) s.up++
    else if (f.rating === -1) s.down++
    fbByStyle.set(key, s)
  }
  const fbRanked = [...fbByStyle.entries()].sort(
    (a, b) => b[1].up - b[1].down - (a[1].up - a[1].down)
  )
  const fbLiked = fb.filter((f) => f.rating === 1).slice(0, 5)
  const fbDisliked = fb.filter((f) => f.rating === -1).slice(0, 5)
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

      <Card title="Stil-Lernen aus echten Chats">
        <p className="mb-2 text-sm text-zinc-400">
          Die KI analysiert deine echten gesendeten Nachrichten (gesyncte Chats +
          optional WhatsApp/Instagram-Exporte) und baut daraus ein Stilprofil samt
          Beispielen — imitiert dich deutlich besser als jede Beschreibung.
        </p>
        <StyleLearnCard
          current={
            learnedStyle?.value &&
            typeof learnedStyle.value === "object" &&
            "profile" in (learnedStyle.value as object)
              ? (learnedStyle.value as unknown as { profile: string; examples: string[] })
              : null
          }
        />
      </Card>

      <Card title="Daumen-Auswertung (👍/👎 an Vorschlägen)">
        <p className="mb-2 text-sm text-zinc-400">
          Jeder Daumen fließt in künftige Vorschläge ein: 👍 werden als „so will ich
          klingen“-Beispiele mitgegeben (letzte 10), 👎 als Anti-Beispiele (letzte 8),
          und die Stil-Tendenz unten steuert, in welche Richtung alle Varianten kippen.
        </p>
        {fb.length ? (
          <div className="space-y-3 text-sm">
            <table className="w-full text-xs">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-1">Stil</th>
                  <th className="py-1 text-right">👍</th>
                  <th className="py-1 text-right">👎</th>
                  <th className="py-1 text-right">Tendenz</th>
                </tr>
              </thead>
              <tbody>
                {fbRanked.map(([s, v]) => (
                  <tr key={s} className="border-t border-zinc-800/60">
                    <td className="py-1 text-zinc-200">{s}</td>
                    <td className="py-1 text-right text-emerald-400">{v.up}</td>
                    <td className="py-1 text-right text-rose-400">{v.down}</td>
                    <td className={`py-1 text-right tabular-nums ${v.up - v.down > 0 ? "text-emerald-400" : v.up - v.down < 0 ? "text-rose-400" : "text-zinc-500"}`}>
                      {v.up - v.down > 0 ? "+" : ""}{v.up - v.down}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fbLiked.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-zinc-500">Zuletzt übernommen 👍</p>
                <ul className="mt-1 space-y-1 text-xs text-zinc-400">
                  {fbLiked.map((f, i) => (
                    <li key={i} className="truncate">„{f.content}“ <span className="text-zinc-600">({f.style ?? "—"})</span></li>
                  ))}
                </ul>
              </div>
            )}
            {fbDisliked.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-zinc-500">Zuletzt abgelehnt 👎</p>
                <ul className="mt-1 space-y-1 text-xs text-zinc-500">
                  {fbDisliked.map((f, i) => (
                    <li key={i} className="truncate">„{f.content}“ <span className="text-zinc-600">({f.style ?? "—"})</span></li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-zinc-600">{fb.length} Bewertungen insgesamt (letzte 500 gezählt).</p>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            Noch keine Daumen vergeben. In der Extension und im Antwortgenerator neben
            jedem Vorschlag 👍/👎 drücken — je mehr, desto treffsicherer wird alles.
          </p>
        )}
      </Card>

      <Card title="Harte Stil-Regeln (werden nie gebrochen)">
        <p className="mb-2 text-sm text-zinc-400">
          Gelten für jeden Antwortvorschlag (App + Extension), stärker als der Schreibstil oben.
          Fest eingebaut: keine Binde-/Gedankenstriche — wird zusätzlich automatisch aus jedem
          Vorschlag entfernt. Hier weitere Verbote/Gebote ergänzen, eine Regel pro Zeile.
        </p>
        <StyleRulesForm current={typeof styleRules?.value === "string" ? styleRules.value : ""} />
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
            {usage.byFeature.length ? (
              <>
                <p className="pt-1 text-xs font-semibold uppercase text-zinc-500">Nach Funktion</p>
                <table className="w-full text-xs text-zinc-400">
                  <tbody>
                    {usage.byFeature.map((f) => (
                      <tr key={f.feature} className="border-t border-zinc-800/60">
                        <td className="py-1">{f.label}</td>
                        <td className="py-1 text-right text-zinc-500">
                          {f.calls}×{f.images ? ` · ${f.images} Bilder` : ""}
                        </td>
                        <td className="py-1 text-right tabular-nums text-zinc-200">
                          ${f.costUsd.toFixed(f.costUsd >= 0.1 ? 2 : 4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-zinc-600">
                  Provider:{" "}
                  {Object.entries(usage.byProvider)
                    .map(([p, v]) => `${p} $${v.costUsd.toFixed(2)} (${v.calls})`)
                    .join(" · ")}
                </p>
              </>
            ) : (
              <p className="text-xs text-zinc-500">Noch keine KI-Calls diesen Monat.</p>
            )}
          </div>
        ) : (
          <p className="mb-3 text-sm text-amber-400">
            Verbrauch nicht abrufbar — SUPABASE_SERVICE_ROLE_KEY fehlt in dieser Umgebung.
          </p>
        )}
        <AiBudgetForm current={usage?.limitUsd ?? 10} currentImageCost={usage?.imageCostUsd ?? null} />
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
