import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { daysUntilBirthday, connectionScore, turningAge } from "@/lib/moments"
import { generateMomentMessages } from "@/lib/ai/momentMessage"
import { generateImagePrompt } from "@/lib/ai/imagePrompt"
import { generateImage, imageGenerationAvailable } from "@/lib/ai/generateImage"
import { sendPushToAll } from "@/lib/push"

export const maxDuration = 120

const VETO_MINUTES = Number(process.env.AUTOPILOT_VETO_MINUTES ?? 10)

/**
 * Täglicher Moments-Scan:
 * - Geburtstag heute + Telegram-Kanal → Auto-Gruß (Text + Bild wenn OPENAI_API_KEY),
 *   als Telegram-Suggestion mit Veto-Fenster in die Queue. Worker sendet nach Frist.
 * - Geburtstage in 1..3 Tagen → Reminder (Follow-up)
 * - vernachlässigte wichtige Kontakte → Check-in-Reminder
 * Kein ungeprüfter Versand: Telegram-Gruß hat Veto, alles andere nur Reminder.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const [{ data: contacts }, { data: styleRow }] = await Promise.all([
    supabase.from("contacts").select("*").neq("pipeline_stage", "archived"),
    supabase.from("settings").select("value").eq("key", "user_style_profile").maybeSingle(),
  ])
  const styleProfile =
    typeof styleRow?.value === "string" && styleRow.value.trim()
      ? styleRow.value
      : "Natürlich, direkt, leicht humorvoll, charmant. Kurze echte Nachrichten."

  const results: { contactId: string; action: string }[] = []

  for (const c of contacts ?? []) {
    const bday = daysUntilBirthday(c.birthday)

    // --- Geburtstag heute: Auto-Gruß über Telegram ---
    if (bday === 0) {
      const { data: tg } = await supabase
        .from("contact_channels")
        .select("handle")
        .eq("contact_id", c.id)
        .eq("channel", "telegram")
        .limit(1)
        .maybeSingle()

      const { data: openDraft } = await supabase
        .from("suggestions")
        .select("id")
        .eq("contact_id", c.id)
        .in("status", ["draft", "approved"])
        .gte("created_at", new Date(Date.now() - 20 * 3600_000).toISOString())
        .limit(1)
        .maybeSingle()

      // Entwurf auch ohne Telegram-Handle: dann channel=manual, du kopierst/sendest selbst.
      if (!openDraft) {
        try {
          const msg = await generateMomentMessages({
            kind: "birthday",
            name: c.name,
            relationship: (c.relationship_tags ?? []).join(", "),
            language: c.language ?? "de",
            styleProfile,
            context: [
              c.interests?.length ? `Interessen: ${c.interests.join(", ")}` : null,
              turningAge(c.birthday) ? `wird ${turningAge(c.birthday)}` : null,
            ].filter(Boolean).join(" · "),
          })
          const text = Object.values(msg.variants)[0] ?? `Alles Gute zum Geburtstag, ${c.name}! 🎉`

          let imageUrl: string | null = null
          if (imageGenerationAvailable()) {
            try {
              const p = await generateImagePrompt({
                occasion: "Geburtstag", name: c.name, style: "Anime",
                details: (c.interests ?? []).join(", "), format: "portrait",
              })
              const img = await generateImage(supabase, p.prompt, { size: "1024x1536", pathPrefix: c.id })
              imageUrl = img.url
              await supabase.from("moment_assets").insert({
                contact_id: c.id, kind: "image", title: "Geburtstagsbild (auto)",
                content: img.url, meta: { prompt: p.prompt, caption: p.caption },
              })
            } catch (e) {
              console.error("Bild-Gen fehlgeschlagen:", e)
            }
          }

          // Auto-Senden nur mit Telegram-Handle; sonst manueller Entwurf zum Kopieren.
          const viaTelegram = !!tg?.handle
          const autoSendAt = viaTelegram && c.auto_mode
            ? new Date(Date.now() + VETO_MINUTES * 60_000).toISOString()
            : null

          await supabase.from("suggestions").insert({
            contact_id: c.id,
            situation: autoSendAt
              ? `🎂 Auto-Geburtstagsgruß — sendet in ${VETO_MINUTES} Min (Veto in Queue)`
              : viaTelegram
                ? "🎂 Geburtstagsgruß — in Queue freigeben"
                : "🎂 Geburtstagsgruß — kopieren und selbst senden (kein Telegram-Handle)",
            variants: msg.variants,
            chosen_variant: Object.keys(msg.variants)[0] ?? null,
            channel: viaTelegram ? "telegram" : "manual",
            status: "draft",
            auto_send_at: autoSendAt,
            image_url: imageUrl,
          })
          results.push({ contactId: c.id, action: imageUrl ? "bday_greeting+image" : "bday_greeting" })
          continue
        } catch (e) {
          console.error("Bday-Gruß fehlgeschlagen:", e)
        }
      }
    }

    // --- Reminder (Follow-up) ---
    let reason: string | null = null
    if (bday != null && bday >= 0 && bday <= 3) {
      reason = bday === 0 ? "🎂 Geburtstag heute!" : `🎂 Geburtstag in ${bday} Tagen`
    } else {
      const { overdue, daysSince } = connectionScore(c)
      if (overdue && (c.relationship_tags?.length ?? 0) > 0) {
        reason = `Kontaktpause — ${daysSince ?? "?"} Tage kein Kontakt, mal melden`
      }
    }
    if (!reason) continue

    const since = new Date(Date.now() - 20 * 3600_000).toISOString()
    const { data: existing } = await supabase
      .from("followups")
      .select("id")
      .eq("contact_id", c.id)
      .eq("done", false)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle()
    if (existing) continue

    await supabase.from("followups").insert({
      contact_id: c.id,
      due_at: new Date().toISOString(),
      reason,
    })
    results.push({ contactId: c.id, action: `reminder: ${reason}` })
  }

  if (results.length) {
    await sendPushToAll({
      title: "MatchOS Moments",
      body: results
        .map((r) => r.action)
        .slice(0, 3)
        .join(" · ")
        .slice(0, 120),
      url: "/moments",
    }).catch(() => {})
  }

  return NextResponse.json({ scanned: contacts?.length ?? 0, created: results.length, results })
}
