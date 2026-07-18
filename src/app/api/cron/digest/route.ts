import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushToAll } from "@/lib/push"
import { sendTelegramBot } from "@/lib/telegramBot"
import { beatCron } from "@/lib/cronHeartbeat"
import { collectSignals, type Signal } from "@/lib/signals"
import { chatJSON } from "@/lib/ai/deepseek"

export const maxDuration = 60

/**
 * Morgen-Briefing (täglich 7:00): sammelt ALLE Signale über collectSignals
 * (dieselbe Quelle wie Dashboard-Feed und /inbox), lässt DeepSeek einen kurzen
 * Tagesplan formulieren (Fallback: deterministische Liste), speichert ihn für
 * die Dashboard-Kachel und schickt ihn per Telegram-Bot (sonst Web-Push).
 * Erzeugt nichts, sendet nichts an Kontakte — reine Übersicht an MICH.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  await beatCron(supabase, "digest")

  const signals = await collectSignals(supabase)
  const today = new Date().toISOString().slice(0, 10)
  const counts = {
    warn: signals.filter((s) => s.prio === 0).length,
    today: signals.filter((s) => s.prio === 1).length,
    soon: signals.filter((s) => s.prio === 2).length,
  }

  let text = fallbackBriefing(signals)
  let source: "ki" | "fallback" = "fallback"
  if (signals.length > 0) {
    try {
      const raw = await chatJSON(
        [
          "Du bist der Morgen-Assistent einer persönlichen Lebens-Plattform (Dating, Freunde/Events, Bewerbungen, DJ-Booking, Paper-Trading).",
          "Schreib aus den gelieferten Signalen ein knappes Morgen-Briefing auf Deutsch, Du-Form, maximal 6 Zeilen.",
          "Reihenfolge: Warnungen (prio 0) zuerst, dann die wichtigsten heutigen Aktionen (prio 1) mit konkreten Namen, dann höchstens eine Zeile Ausblick (prio 2, zusammengefasst).",
          "STRIKT: nur Fakten aus den Signalen verwenden, NICHTS erfinden, keine Namen oder Zahlen dazudichten. Kein Gruß, kein Motivations-Blabla — direkt zur Sache.",
          'Antworte als JSON: {"text": "…"} — Zeilen mit \\n getrennt, gern mit den mitgelieferten Icons.',
        ].join(" "),
        JSON.stringify(
          signals.slice(0, 40).map((s) => ({
            prio: s.prio,
            modul: s.module,
            icon: s.icon,
            titel: s.title,
            detail: s.detail ?? null,
          }))
        ),
        "briefing"
      )
      const parsed = JSON.parse(raw) as { text?: string }
      if (typeof parsed.text === "string" && parsed.text.trim().length > 10) {
        text = parsed.text.trim()
        source = "ki"
      }
    } catch {
      /* KI optional — deterministischer Fallback steht schon */
    }
  }

  await supabase
    .from("settings")
    .upsert(
      { key: "morning_briefing", value: JSON.stringify({ date: today, text, counts, source }) },
      { onConflict: "key" }
    )

  let sent: "telegram" | "push" | "none" = "none"
  if (signals.length > 0) {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

    // Inline-Buttons: Links immer; Aktions-Knöpfe (Erledigt/Snooze) nur wenn
    // der Webhook aktiviert ist — sonst wären sie tot.
    const { data: hookRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "telegram_webhook_secret")
      .maybeSingle()
    const hookActive = typeof hookRow?.value === "string" && hookRow.value.length > 0
    const keyboard: { text: string; url?: string; callback_data?: string }[][] = [
      [
        { text: "📥 Inbox", url: "https://matchos-ten.vercel.app/inbox" },
        { text: "▶ Fokus", url: "https://matchos-ten.vercel.app/focus" },
      ],
    ]
    if (hookActive) {
      for (const s of signals.filter((x) => x.prio === 1 && x.followupId).slice(0, 3)) {
        const short = s.title.split(":")[0].slice(0, 24)
        keyboard.push([
          { text: `✓ ${short}`, callback_data: `fu:${s.followupId}` },
          { text: "💤 1d", callback_data: `sn:${s.key}:1` },
        ])
      }
    }

    const viaTelegram = await sendTelegramBot(
      supabase,
      `🌅 <b>Morgen-Briefing</b>\n\n${esc(text)}`,
      { inline_keyboard: keyboard }
    )
    if (viaTelegram) {
      sent = "telegram"
    } else {
      await sendPushToAll({
        title: "MatchOS — Morgen-Briefing",
        body: `${counts.today} heute dran · ${counts.soon} demnächst${counts.warn ? ` · ⚠️ ${counts.warn} Warnungen` : ""}`,
        url: "/inbox",
      }).catch(() => {})
      sent = "push"
    }
  }

  return NextResponse.json({ ...counts, source, sent })
}

/** Ohne KI trotzdem brauchbar: Warnungen + Top-Aktionen als Liste. */
function fallbackBriefing(signals: Signal[]): string {
  if (signals.length === 0) return "Alles ruhig — keine offenen Aktionen. 🏝"
  const lines: string[] = []
  for (const s of signals.filter((x) => x.prio === 0)) lines.push(`⚠️ ${s.title}`)
  for (const s of signals.filter((x) => x.prio === 1).slice(0, 6)) {
    lines.push(`${s.icon} ${s.title}${s.detail ? ` — ${s.detail}` : ""}`)
  }
  const soon = signals.filter((x) => x.prio === 2).length
  if (soon > 0) lines.push(`🔭 dazu ${soon} Dinge demnächst — Details in der Inbox`)
  return lines.join("\n")
}
