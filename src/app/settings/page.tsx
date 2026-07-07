import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui"
import { StyleForm } from "./StyleForm"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: style } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "user_style_profile")
    .maybeSingle()

  const hasDeepseek = !!process.env.DEEPSEEK_API_KEY
  const hasTelegram = !!process.env.TELEGRAM_SESSION

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Einstellungen</h1>

      <Card title="Mein Schreibstil">
        <p className="mb-2 text-sm text-zinc-400">
          Beschreibt, wie der Generator für dich klingt. Beispiele eigener Nachrichten reinkopieren hilft enorm.
        </p>
        <StyleForm current={typeof style?.value === "string" ? style.value : ""} />
      </Card>

      <Card title="API-Status">
        <ul className="space-y-1 text-sm">
          <li className={hasDeepseek ? "text-emerald-400" : "text-amber-400"}>
            {hasDeepseek ? "✓" : "✗"} DeepSeek API {hasDeepseek ? "verbunden" : "— DEEPSEEK_API_KEY in .env.local eintragen"}
          </li>
          <li className={hasTelegram ? "text-emerald-400" : "text-zinc-500"}>
            {hasTelegram ? "✓" : "○"} Telegram {hasTelegram ? "Session vorhanden" : "— optional, siehe README (npm run telegram:login)"}
          </li>
        </ul>
      </Card>
    </div>
  )
}
