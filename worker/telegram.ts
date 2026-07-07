/**
 * Telegram-Worker (lokal laufen lassen: npm run worker)
 *
 * - Empfängt Nachrichten von Kontakten mit hinterlegtem Telegram-Handle
 *   und speichert sie in `messages`.
 * - Pollt alle 15s freigegebene Vorschläge (status=approved, channel=telegram)
 *   und sendet die gewählte Variante. Sendet NIE ohne Freigabe in der Queue.
 *
 * Hinweis: Automatisierung des eigenen Telegram-Accounts ist ToS-Grauzone.
 * Eigenverantwortlich nutzen, moderate Frequenz, keine Massen-Nachrichten.
 */
import { TelegramClient } from "telegram"
import { StringSession } from "telegram/sessions"
import { NewMessage, type NewMessageEvent } from "telegram/events"
import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import type { Database } from "../src/lib/database.types"

config({ path: ".env.local" })

const apiId = Number(process.env.TELEGRAM_API_ID)
const apiHash = process.env.TELEGRAM_API_HASH ?? ""
const session = process.env.TELEGRAM_SESSION ?? ""
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

if (!apiId || !apiHash || !session) {
  console.error("Telegram-Env fehlt. Erst `npm run telegram:login` ausführen.")
  process.exit(1)
}
if (!supabaseUrl || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen.")
  process.exit(1)
}

const matchosUrl = (process.env.MATCHOS_URL ?? "https://matchos-ten.vercel.app").replace(/\/$/, "")
const VETO_MINUTES = Number(process.env.AUTOPILOT_VETO_MINUTES ?? 10)

const supabase = createClient<Database>(supabaseUrl, serviceKey)
const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
  connectionRetries: 5,
})

/** Handle (ohne @, lowercase) → contact_id */
async function contactByHandle(username: string | null | undefined) {
  if (!username) return null
  const { data } = await supabase
    .from("contact_channels")
    .select("contact_id, handle")
    .eq("channel", "telegram")
  const norm = username.toLowerCase().replace(/^@/, "")
  return (
    data?.find((c) => c.handle.toLowerCase().replace(/^@/, "") === norm)
      ?.contact_id ?? null
  )
}

async function onIncoming(event: NewMessageEvent) {
  try {
    const msg = event.message
    if (!msg.text || event.isChannel || event.isGroup) return
    const sender = await msg.getSender()
    const username =
      sender && "username" in sender ? (sender.username as string | null) : null
    const contactId = await contactByHandle(username)
    if (!contactId) return

    await supabase.from("messages").insert({
      contact_id: contactId,
      direction: "in",
      channel: "telegram",
      content: msg.text,
      source: "telegram",
      sent_at: new Date(msg.date * 1000).toISOString(),
    })
    console.log(`← ${username}: ${msg.text.slice(0, 60)}`)
    await draftReply(contactId, username ?? "?")
  } catch (e) {
    console.error("Eingang-Fehler:", e)
  }
}

/** Extension-Token aus settings — für Aufrufe der Reply-API. */
async function apiToken(): Promise<string | null> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "extension_token")
    .maybeSingle()
  return typeof data?.value === "string" ? data.value : null
}

/**
 * Nach eingehender Nachricht: Antwortentwurf in die Queue.
 * auto_mode am Kontakt → Veto-Fenster (auto_send_at), sonst normaler Entwurf.
 * Benachrichtigung an mich selbst (Telegram Saved Messages).
 */
async function draftReply(contactId: string, username: string) {
  try {
    const { data: openDraft } = await supabase
      .from("suggestions")
      .select("id")
      .eq("contact_id", contactId)
      .in("status", ["draft", "approved"])
      .limit(1)
      .maybeSingle()
    if (openDraft) return

    const token = await apiToken()
    if (!token) {
      console.warn("Kein extension_token in settings — kein Auto-Entwurf.")
      return
    }
    const res = await fetch(`${matchosUrl}/api/extension/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ contactId, situation: "Antworte passend auf die letzte Nachricht." }),
    })
    if (!res.ok) {
      console.error("Reply-API-Fehler:", res.status, await res.text())
      return
    }
    const reply = (await res.json()) as {
      variants: Record<string, string>
      next_step: string
    }

    const { data: contact } = await supabase
      .from("contacts")
      .select("name, auto_mode")
      .eq("id", contactId)
      .single()
    const auto = contact?.auto_mode ?? false
    const autoSendAt = auto
      ? new Date(Date.now() + VETO_MINUTES * 60_000).toISOString()
      : null

    await supabase.from("suggestions").insert({
      contact_id: contactId,
      situation: auto
        ? `Autopilot — sendet ${VETO_MINUTES} Min nach Eingang, Veto in der Queue`
        : "Auto-Entwurf nach Telegram-Eingang",
      variants: reply.variants,
      chosen_variant: auto ? "locker" : null,
      channel: "telegram",
      status: "draft",
      auto_send_at: autoSendAt,
    })

    // Benachrichtigung an mich (Saved Messages)
    const preview = reply.variants["locker"]?.slice(0, 120) ?? ""
    await client.sendMessage("me", {
      message: auto
        ? `🤖 MatchOS Autopilot: Antwort an ${contact?.name ?? username} geht in ${VETO_MINUTES} Min raus:\n\n„${preview}“\n\nVeto: ${matchosUrl}/queue`
        : `📝 MatchOS: Entwurf für ${contact?.name ?? username} liegt in der Queue: ${matchosUrl}/queue`,
    })
    console.log(`✎ Entwurf für ${username}${auto ? ` (auto, ${VETO_MINUTES}m)` : ""}`)
  } catch (e) {
    console.error("Draft-Fehler:", e)
  }
}

async function sendApproved() {
  // Abgelaufene Veto-Fenster: Draft → approved (Autopilot)
  await supabase
    .from("suggestions")
    .update({ status: "approved" })
    .eq("status", "draft")
    .eq("channel", "telegram")
    .not("auto_send_at", "is", null)
    .lte("auto_send_at", new Date().toISOString())

  const { data: approved } = await supabase
    .from("suggestions")
    .select("*")
    .eq("status", "approved")
    .eq("channel", "telegram")
  for (const s of approved ?? []) {
    const variants = (s.variants ?? {}) as Record<string, string>
    const text = s.chosen_variant ? variants[s.chosen_variant] : null
    if (!text) {
      console.warn(`Suggestion ${s.id}: keine gewählte Variante, überspringe.`)
      continue
    }
    const { data: channels } = await supabase
      .from("contact_channels")
      .select("handle")
      .eq("contact_id", s.contact_id)
      .eq("channel", "telegram")
      .limit(1)
    const handle = channels?.[0]?.handle
    if (!handle) {
      console.warn(`Suggestion ${s.id}: kein Telegram-Handle am Kontakt.`)
      continue
    }
    try {
      await client.sendMessage(handle.replace(/^@/, ""), { message: text })
      await supabase
        .from("suggestions")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", s.id)
      await supabase.from("messages").insert({
        contact_id: s.contact_id,
        direction: "out",
        channel: "telegram",
        content: text,
        source: "telegram",
      })
      console.log(`→ ${handle}: ${text.slice(0, 60)}`)
    } catch (e) {
      console.error(`Senden an ${handle} fehlgeschlagen:`, e)
    }
  }
}

async function main() {
  await client.connect()
  console.log("Telegram-Worker läuft. Eingehende Nachrichten werden gespeichert, freigegebene Entwürfe gesendet.")
  client.addEventHandler(onIncoming, new NewMessage({ incoming: true }))
  setInterval(sendApproved, 15_000)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
