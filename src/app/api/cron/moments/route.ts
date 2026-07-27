import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { daysUntilBirthday, connectionScore, turningAge } from "@/lib/moments"
import { generateMomentMessages } from "@/lib/ai/momentMessage"
import { generateImagePrompt } from "@/lib/ai/imagePrompt"
import { generateImage, imageGenerationAvailable } from "@/lib/ai/generateImage"
import { sendPushToAll } from "@/lib/push"
import { beatCron, cronAuthError } from "@/lib/cronHeartbeat"

export const maxDuration = 120

const VETO_MINUTES = Number(process.env.AUTOPILOT_VETO_MINUTES ?? 10)
// Vorlauf: Gruß + Bild schon N Tage vor dem Geburtstag als Entwurf erzeugen,
// damit Zeit zum Anpassen bleibt (Karte drucken, Bild neu würfeln, Text ändern).
const BDAY_LEAD_DAYS = 3

/**
 * Täglicher Moments-Scan:
 * - Geburtstag in BDAY_LEAD_DAYS Tagen → Gruß (Text + Bild wenn OPENAI_API_KEY)
 *   vorab als Entwurf in die Queue, ohne Auto-Versand.
 * - Geburtstag heute: Entwurf aus dem Vorlauf wird (bei Telegram + auto_mode)
 *   mit Veto-Fenster scharfgeschaltet; ohne Vorlauf-Entwurf frisch erzeugt.
 * - Geburtstage in 1..3 Tagen → Reminder (Follow-up)
 * - vernachlässigte wichtige Kontakte → Check-in-Reminder
 * Kein ungeprüfter Versand: Telegram-Gruß hat Veto, alles andere nur Reminder.
 */
export async function GET(req: Request) {
  const denied = cronAuthError(req)
  if (denied) return denied

  const supabase = createAdminClient()
  await beatCron(supabase, "moments")
  const [{ data: contacts }, { data: styleRow }] = await Promise.all([
    supabase.from("contacts").select("*").eq("realm", "moment").neq("pipeline_stage", "archived"),
    supabase.from("settings").select("value").eq("key", "user_style_profile").maybeSingle(),
  ])
  const styleProfile =
    typeof styleRow?.value === "string" && styleRow.value.trim()
      ? styleRow.value
      : "Natürlich, direkt, leicht humorvoll, charmant. Kurze echte Nachrichten."

  const results: { contactId: string; action: string }[] = []

  for (const c of contacts ?? []) {
    const bday = daysUntilBirthday(c.birthday)

    // --- Geburtstag heute ODER in BDAY_LEAD_DAYS Tagen: Gruß erzeugen ---
    if (bday === 0 || bday === BDAY_LEAD_DAYS) {
      const { data: tg } = await supabase
        .from("contact_channels")
        .select("handle")
        .eq("contact_id", c.id)
        .eq("channel", "telegram")
        .limit(1)
        .maybeSingle()

      // Fenster: am Geburtstag selbst zählt auch der Vorlauf-Entwurf von vor
      // BDAY_LEAD_DAYS Tagen als vorhanden (kein Doppel-Gruß), am Vorlauf-Tag
      // nur frische Entwürfe der letzten 20h.
      const windowH = bday === 0 ? (BDAY_LEAD_DAYS + 1) * 24 : 20
      const { data: openDraft } = await supabase
        .from("suggestions")
        .select("id, channel, auto_send_at")
        .eq("contact_id", c.id)
        .in("status", ["draft", "approved"])
        .gte("created_at", new Date(Date.now() - windowH * 3600_000).toISOString())
        .limit(1)
        .maybeSingle()

      // Geburtstag heute + Vorlauf-Entwurf liegt bereit: bei Telegram + auto_mode
      // jetzt mit Veto-Fenster scharfschalten, sonst bleibt er manuell in der Queue.
      if (bday === 0 && openDraft && !openDraft.auto_send_at && openDraft.channel === "telegram" && c.auto_mode) {
        await supabase
          .from("suggestions")
          .update({
            auto_send_at: new Date(Date.now() + VETO_MINUTES * 60_000).toISOString(),
            situation: `🎂 Auto-Geburtstagsgruß (aus Vorlauf) — sendet in ${VETO_MINUTES} Min (Veto in Queue)`,
          })
          .eq("id", openDraft.id)
        results.push({ contactId: c.id, action: "bday_lead_armed" })
      }

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

          // Auto-Senden nur am Geburtstag selbst und nur mit Telegram-Handle;
          // Vorlauf-Entwürfe warten in der Queue (Scharfschalten macht der Tag-0-Lauf).
          const viaTelegram = !!tg?.handle
          const autoSendAt = bday === 0 && viaTelegram && c.auto_mode
            ? new Date(Date.now() + VETO_MINUTES * 60_000).toISOString()
            : null

          await supabase.from("suggestions").insert({
            contact_id: c.id,
            situation: bday === BDAY_LEAD_DAYS
              ? `🎂 Geburtstag in ${BDAY_LEAD_DAYS} Tagen — Gruß vorbereitet, anpassen oder liegen lassen`
              : autoSendAt
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
      reason =
        bday === 0
          ? "🎂 Geburtstag heute!"
          : bday === 1
            ? "🎂 Geburtstag morgen"
            : `🎂 Geburtstag in ${bday} Tagen`
    } else {
      const { overdue, daysSince } = connectionScore(c)
      if (overdue && (c.relationship_tags?.length ?? 0) > 0) {
        reason = `Kontaktpause — ${daysSince ?? "?"} Tage kein Kontakt, mal melden`
      }
    }
    if (!reason) continue

    // EIN offener Reminder pro Kontakt reicht: existiert schon einer, wird nur
    // der Text aktuell gehalten (44 → 45 Tage) statt täglich neu zu stapeln.
    // Solange irgendein Follow-up offen ist (auch manuell), kommt kein zweites dazu.
    const { data: openFollowups } = await supabase
      .from("followups")
      .select("id, reason")
      .eq("contact_id", c.id)
      .eq("done", false)
    const isCronReminder = (r: string | null) =>
      !!r && (r.startsWith("🎂 Geburtstag") || r.startsWith("Kontaktpause — "))
    if (openFollowups?.length) {
      const mine = openFollowups.find((f) => isCronReminder(f.reason))
      if (mine && mine.reason !== reason) {
        await supabase.from("followups").update({ reason }).eq("id", mine.id)
        results.push({ contactId: c.id, action: `reminder aktualisiert: ${reason}` })
      }
      continue
    }

    await supabase.from("followups").insert({
      contact_id: c.id,
      due_at: new Date().toISOString(),
      reason,
    })
    results.push({ contactId: c.id, action: `reminder: ${reason}` })
  }

  if (results.length) {
    await sendPushToAll({
      title: "MomentOS",
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
