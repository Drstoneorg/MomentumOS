"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { generateJobCoverLetter } from "@/lib/actions"

const SITE_URL = "https://matchos-ten.vercel.app"

async function db() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Nicht eingeloggt")
  return supabase
}

/** Signal für N Tage ausblenden — taucht danach von selbst wieder auf. */
export async function snoozeSignal(key: string, days: number): Promise<{ error?: string }> {
  try {
    const supabase = await db()
    const until = new Date(Date.now() + days * 86400_000).toISOString()
    const { error } = await supabase
      .from("signal_snoozes")
      .upsert({ key, until }, { onConflict: "key" })
    if (error) return { error: error.message }
    // Abgelaufene bei der Gelegenheit wegräumen (billig, hält die Tabelle klein)
    await supabase.from("signal_snoozes").delete().lt("until", new Date().toISOString())
    revalidatePath("/")
    revalidatePath("/inbox")
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Fehler" }
  }
}

/**
 * Bewerbungs-Einklick-Paket: Anschreiben generieren (falls noch keins da) und
 * alles fürs mailto zurückgeben. Ein Knopf im Signal statt vier Schritte.
 */
export async function jobLetterPackage(jobId: string): Promise<{
  letter?: string
  email?: string | null
  subject?: string
  error?: string
}> {
  try {
    const supabase = await db()
    const { data: job } = await supabase
      .from("job_applications")
      .select("title, company, contact_email, cover_letter")
      .eq("id", jobId)
      .maybeSingle()
    if (!job) return { error: "Stelle nicht gefunden" }
    const letter = job.cover_letter?.trim()
      ? job.cover_letter
      : await generateJobCoverLetter(jobId)
    revalidatePath("/jobs")
    return {
      letter,
      email: job.contact_email,
      subject: `Bewerbung als ${job.title}`,
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Anschreiben fehlgeschlagen" }
  }
}

/**
 * Telegram-Inline-Buttons aktivieren: registriert den Webhook beim Bot mit
 * frischem secret_token. Danach kommen Briefing-Nachrichten mit Knöpfen
 * (Erledigt/Snooze/Freigeben) — Aktionen laufen über /api/telegram/webhook.
 */
export async function setupTelegramWebhook(): Promise<{ error?: string }> {
  try {
    const supabase = await db()
    const { data: tokenRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "telegram_bot_token")
      .maybeSingle()
    const token = typeof tokenRow?.value === "string" ? tokenRow.value.trim() : ""
    if (!token) return { error: "Erst Bot-Token speichern" }

    const secret = randomUUID().replace(/-/g, "")
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: `${SITE_URL}/api/telegram/webhook`,
        secret_token: secret,
        allowed_updates: ["callback_query"],
      }),
    })
    const body = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null
    if (!res.ok || !body?.ok) return { error: body?.description ?? "setWebhook fehlgeschlagen" }

    await supabase
      .from("settings")
      .upsert({ key: "telegram_webhook_secret", value: secret }, { onConflict: "key" })
    revalidatePath("/settings")
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Fehler" }
  }
}

export async function disableTelegramWebhook(): Promise<{ error?: string }> {
  try {
    const supabase = await db()
    const { data: tokenRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "telegram_bot_token")
      .maybeSingle()
    const token = typeof tokenRow?.value === "string" ? tokenRow.value.trim() : ""
    if (token) {
      await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: "POST" }).catch(
        () => {}
      )
    }
    await supabase.from("settings").delete().eq("key", "telegram_webhook_secret")
    revalidatePath("/settings")
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Fehler" }
  }
}
