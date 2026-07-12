import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

/**
 * Telegram-Bot-Versand (Bot-API, kein Worker nötig): schickt Nachrichten an den
 * User selbst (Digest, Warnungen) — NIE an Matches. Bot-Token + Chat-ID kommen
 * aus den Einstellungen (User legt den Bot selbst über @BotFather an).
 */
export async function sendTelegramBot(
  supabase: SupabaseClient<Database>,
  text: string
): Promise<boolean> {
  const [{ data: tokenRow }, { data: chatRow }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "telegram_bot_token").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "telegram_chat_id").maybeSingle(),
  ])
  const token = typeof tokenRow?.value === "string" ? tokenRow.value.trim() : ""
  const chatId = typeof chatRow?.value === "string" ? chatRow.value.trim() : ""
  if (!token || !chatId) return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    })
    return res.ok
  } catch {
    return false
  }
}
