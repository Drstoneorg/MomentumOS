import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimitOk } from "@/lib/rateLimit"
import { zusagenMitBegleitung } from "@/lib/inviteScore"
import { sendPushToAll } from "@/lib/push"
import { rsvpPush } from "@/lib/pushTexte"

/**
 * Öffentliche Zusage/Absage über den persönlichen Einladungs-Link.
 * Auth ist der rsvp_token selbst (32 Hex, unique, pro Einladung) — kein Login,
 * kein Cookie. Schreibt ausschließlich Felder der EINEN Einladung (plus einem
 * Gedächtnis-Eintrag beim eigenen Kontakt). Tabelle bleibt für anon zu; der
 * Weg hier läuft über den Service-Role-Client.
 *
 * antwort: "ja" | "nein" | "warteliste" | "feedback"
 * - ja bei vollem Event wird serverseitig zur Warteliste (kein Überbuchen per Link)
 * - nein macht einen Platz frei → Nachrück-Entwurf für den ältesten
 *   Wartelisten-Gast in die Queue (gesendet wird wie immer nur von Hand)
 * - feedback nur nach dem Event: 1–5 + Kommentar, fließt ins Gedächtnis
 */

export const maxDuration = 15

const clip = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null
  const s = v.trim().slice(0, max)
  return s || null
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 })
  }

  const token = typeof body.token === "string" ? body.token.trim() : ""
  const antwort =
    body.antwort === "ja"
      ? "yes"
      : body.antwort === "nein"
        ? "no"
        : body.antwort === "warteliste"
          ? "waitlist"
          : body.antwort === "feedback"
            ? "feedback"
            : null
  if (!/^[a-f0-9]{32}$/.test(token) || !antwort) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 })
  }
  const plusOnes =
    antwort === "yes" && typeof body.plus_ones === "number"
      ? Math.min(3, Math.max(0, Math.round(body.plus_ones)))
      : 0
  const companionNames = clip(body.companion_names, 160)
  const kommentar = clip(body.comment, 500)
  const rating =
    typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5
      ? Math.round(body.rating)
      : null

  const ip = (req.headers.get("x-forwarded-for") ?? "?").split(",")[0].trim()
  try {
    const [ipOk, globalOk] = await Promise.all([
      rateLimitOk(`rsvp:${ip}`, 20),
      rateLimitOk("rsvp:gesamt", 120),
    ])
    if (!ipOk || !globalOk) {
      return NextResponse.json({ error: "Zu viele Anfragen, bitte später" }, { status: 429 })
    }
  } catch {
    // Limit-Zähler defekt blockiert keine Zusage — Token bleibt die Hürde
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: "Server nicht konfiguriert" }, { status: 500 })
  }

  const { data: invite } = await admin
    .from("event_invites")
    .select(
      "id, status, contact_id, event_id, comment, feedback_at, contacts(name), events(id, title, starts_at, capacity)"
    )
    .eq("rsvp_token", token)
    .maybeSingle()
  if (!invite?.events) {
    return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 })
  }
  const event = invite.events

  // ---- Feedback nach dem Event (1 Frage) ----
  if (antwort === "feedback") {
    const vorbei =
      !!event.starts_at && Date.now() > new Date(event.starts_at).getTime() + 6 * 3600_000
    if (!vorbei || !rating) {
      return NextResponse.json({ error: "Feedback geht erst nach dem Event" }, { status: 400 })
    }
    const erstesMal = !invite.feedback_at
    const { error } = await admin
      .from("event_invites")
      .update({
        feedback_rating: rating,
        feedback_comment: kommentar,
        feedback_at: new Date().toISOString(),
      })
      .eq("id", invite.id)
    if (error) return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 })
    if (erstesMal) {
      await admin
        .from("memories")
        .insert({
          contact_id: invite.contact_id,
          kind: "fact",
          content: `Feedback zu „${event.title}": ${rating}/5${kommentar ? ` — ${kommentar}` : ""}`,
        })
        .then(() => {})
    }
    return NextResponse.json({ ok: true, status: invite.status, feedback: rating })
  }

  // ---- Zusage / Absage / Warteliste ----
  // Ticket gekauft oder schon da gewesen: Status ist final, nur Begleitung/Namen änderbar
  const statusFinal = ["ticket", "attended"].includes(invite.status)

  // Volles Haus: „ja" wird zur Warteliste statt zu überbuchen
  // (feedback ist oben schon abgehandelt und returnt)
  let zielStatus = antwort as "yes" | "no" | "waitlist"
  let voll = false
  if (!statusFinal && zielStatus === "yes" && event.capacity) {
    const { data: alle } = await admin
      .from("event_invites")
      .select("status, plus_ones")
      .eq("event_id", invite.event_id)
      .neq("id", invite.id)
    const stand = zusagenMitBegleitung(alle ?? [])
    if (stand.gesamt + 1 + plusOnes > event.capacity) {
      zielStatus = "waitlist"
      voll = true
    }
  }

  const patch: {
    status?: "yes" | "no" | "waitlist"
    plus_ones: number
    companion_names?: string
    comment?: string
  } = statusFinal
    ? { plus_ones: plusOnes }
    : { status: zielStatus, plus_ones: zielStatus === "yes" ? plusOnes : 0 }
  if (companionNames !== null) patch.companion_names = companionNames
  if (kommentar !== null) patch.comment = kommentar

  const { error } = await admin.from("event_invites").update(patch).eq("id", invite.id)
  if (error) return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 })

  // Kommentar des Gasts landet als Gedächtnis-Eintrag am Kontakt (einmal je Text)
  if (kommentar && kommentar !== invite.comment) {
    await admin
      .from("memories")
      .insert({
        contact_id: invite.contact_id,
        kind: "fact",
        content: `RSVP-Kommentar zu „${event.title}": ${kommentar}`,
      })
      .then(() => {})
  }

  // Absage nach Zusage macht einen Platz frei → Nachrück-Entwurf für den
  // ältesten Wartelisten-Gast (nur Entwurf in der Queue, kein Autoversand)
  if (!statusFinal && zielStatus === "no" && invite.status === "yes") {
    try {
      const { data: naechster } = await admin
        .from("event_invites")
        .select("contact_id, rsvp_token, contacts(name, language)")
        .eq("event_id", invite.event_id)
        .eq("status", "waitlist")
        .order("created_at")
        .limit(1)
        .maybeSingle()
      if (naechster?.contacts) {
        const { data: offen } = await admin
          .from("suggestions")
          .select("id")
          .eq("contact_id", naechster.contact_id)
          .eq("situation", `Event-Nachrück: ${event.title}`)
          .in("status", ["draft", "approved"])
          .limit(1)
          .maybeSingle()
        if (!offen) {
          const { SITE_URL } = await import("@/lib/siteUrl")
          const en = naechster.contacts.language === "en"
          const vorname = naechster.contacts.name.trim().split(/\s+/)[0]
          const url = `${SITE_URL}/einladung/${naechster.rsvp_token}`
          await admin.from("suggestions").insert({
            contact_id: naechster.contact_id,
            situation: `Event-Nachrück: ${event.title}`,
            channel: "manual",
            status: "draft",
            variants: {
              nachrücken: en
                ? `Hey ${vorname}, a spot just opened up for ${event.title} 🖤 you're first on the list, tap here if you're in: ${url}`
                : `Hey ${vorname}, bei ${event.title} ist gerade ein Platz frei geworden 🖤 du bist als erstes dran, sag hier zu wenn du magst: ${url}`,
            },
          })
        }
      }
    } catch {
      // Nachrücken ist Bonus — die Absage selbst ist längst gespeichert
    }
  }

  // Sofort aufs Handy: neue Antwort als Push (nur bei echtem Statuswechsel,
  // damit ein zweiter Klick auf denselben Knopf nicht erneut klingelt).
  // Fehler beim Push dürfen die Antwort nie scheitern lassen.
  if (!statusFinal && zielStatus !== invite.status) {
    try {
      await sendPushToAll({
        ...rsvpPush(invite.contacts?.name ?? "Jemand", event.title, zielStatus, plusOnes),
        url: `/moments/events/${invite.event_id}/einladen`,
      })
    } catch {
      /* Push ist Bonus */
    }
  }

  return NextResponse.json({
    ok: true,
    status: statusFinal ? invite.status : zielStatus,
    voll,
  })
}
