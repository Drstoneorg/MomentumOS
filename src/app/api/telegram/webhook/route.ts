import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseCallback } from "@/lib/telegramCallbacks"

export const maxDuration = 30

/**
 * Telegram-Webhook für Inline-Buttons: Erledigt / Snooze / Freigeben / Zeigen
 * direkt aus dem Chat. Sicherheit: secret_token-Header (beim setWebhook gesetzt)
 * MUSS stimmen, und nur Callbacks aus MEINEM Chat (telegram_chat_id) zählen.
 * Freigeben ist derselbe bewusste Klick wie in der Queue — gesendet wird
 * weiterhin nur vom Worker nach Freigabe, nie ungefragt.
 */
export async function POST(req: Request) {
  const supabase = createAdminClient()

  const { data: secretRow } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "telegram_webhook_secret")
    .maybeSingle()
  const secret = typeof secretRow?.value === "string" ? secretRow.value : ""
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const update = (await req.json().catch(() => null)) as {
    callback_query?: {
      id: string
      data?: string
      from?: { id?: number }
      message?: { chat?: { id?: number } }
    }
  } | null
  const cb = update?.callback_query
  if (!cb) return NextResponse.json({ ok: true })

  const [{ data: chatRow }, { data: tokenRow }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "telegram_chat_id").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "telegram_bot_token").maybeSingle(),
  ])
  const myChatId = typeof chatRow?.value === "string" ? chatRow.value.trim() : ""
  const token = typeof tokenRow?.value === "string" ? tokenRow.value.trim() : ""
  const fromChat = String(cb.message?.chat?.id ?? cb.from?.id ?? "")
  if (!myChatId || fromChat !== myChatId) {
    return NextResponse.json({ ok: true })
  }

  async function answer(text: string) {
    if (!token) return
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: cb!.id, text }),
    }).catch(() => {})
  }
  async function send(text: string) {
    if (!token) return
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: myChatId, text }),
    }).catch(() => {})
  }

  const action = parseCallback(cb.data)
  if (!action) {
    await answer("Unbekannte Aktion")
    return NextResponse.json({ ok: true })
  }

  if (action.kind === "fu") {
    const { error } = await supabase
      .from("followups")
      .update({ done: true })
      .eq("id", action.id)
    await answer(error ? "Fehler beim Erledigen" : "✓ Erledigt")
  } else if (action.kind === "sn") {
    const until = new Date(Date.now() + action.days * 86400_000).toISOString()
    const { error } = await supabase
      .from("signal_snoozes")
      .upsert({ key: action.id, until }, { onConflict: "key" })
    await answer(error ? "Fehler beim Snoozen" : `💤 Bis in ${action.days}d ausgeblendet`)
  } else if (action.kind === "ap") {
    // Nur Entwürfe freigeben — sonst passiert nichts (kein Doppel-Senden)
    const { data: s } = await supabase
      .from("suggestions")
      .select("id, status, chosen_variant, variants")
      .eq("id", action.id)
      .maybeSingle()
    if (!s || s.status !== "draft") {
      await answer("Nicht mehr offen")
    } else {
      const variants = (s.variants ?? {}) as Record<string, string>
      const chosen = s.chosen_variant ?? Object.keys(variants)[0]
      if (!chosen) {
        await answer("Kein Text im Entwurf")
      } else {
        const { error } = await supabase
          .from("suggestions")
          .update({ status: "approved", chosen_variant: chosen })
          .eq("id", s.id)
        await answer(error ? "Fehler bei Freigabe" : "✓ Freigegeben — Worker sendet")
      }
    }
  } else if (action.kind === "sh") {
    const { data: s } = await supabase
      .from("suggestions")
      .select("chosen_variant, variants, contacts(name)")
      .eq("id", action.id)
      .maybeSingle()
    const variants = (s?.variants ?? {}) as Record<string, string>
    const text = s ? variants[s.chosen_variant ?? ""] ?? Object.values(variants)[0] : null
    await answer(text ? "Schicke Text…" : "Entwurf nicht gefunden")
    if (text) await send(`📝 Entwurf für ${s?.contacts?.name ?? "?"}:\n\n${text}`)
  }

  return NextResponse.json({ ok: true })
}
