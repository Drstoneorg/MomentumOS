"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { Enums, Json, TablesInsert, TablesUpdate } from "@/lib/database.types"
import { removeStorageObjectByUrl } from "@/lib/storage"

async function db() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Nicht angemeldet")
  return supabase
}

// ---------- Friends ----------
export async function logContact(
  contactId: string,
  initiator: "me" | "them"
) {
  const supabase = await db()
  await supabase
    .from("contacts")
    .update({
      last_contact_at: new Date().toISOString(),
      last_contact_initiator: initiator,
    })
    .eq("id", contactId)
  revalidatePath(`/contacts/${contactId}`)
  revalidatePath("/moments")
}

export async function updateFriendMeta(
  contactId: string,
  input: {
    birthday?: string | null
    relationship_tags?: string[]
    contact_frequency_days?: number | null
  }
) {
  const supabase = await db()
  await supabase.from("contacts").update(input).eq("id", contactId)
  revalidatePath(`/contacts/${contactId}`)
  revalidatePath("/moments")
}

// ---------- Events ----------
export async function createEvent(input: TablesInsert<"events">) {
  const supabase = await db()
  const { data, error } = await supabase.from("events").insert(input).select("id").single()
  if (error) throw new Error(error.message)
  revalidatePath("/moments/events")
  return data.id
}

export async function updateEvent(id: string, input: TablesUpdate<"events">) {
  const supabase = await db()
  const { error } = await supabase.from("events").update(input).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath(`/moments/events/${id}`)
}

export async function deleteEvent(id: string) {
  const supabase = await db()
  await supabase.from("events").delete().eq("id", id)
  revalidatePath("/moments/events")
}

export async function inviteToEvent(eventId: string, contactIds: string[]) {
  const supabase = await db()
  const rows = contactIds.map((contact_id) => ({ event_id: eventId, contact_id }))
  const { error } = await supabase
    .from("event_invites")
    .upsert(rows, { onConflict: "event_id,contact_id", ignoreDuplicates: true })
  if (error) throw new Error(error.message)
  revalidatePath(`/moments/events/${eventId}`)
}

export async function setInviteStatus(
  id: string,
  eventId: string,
  status: Enums<"event_invite_status">,
  inviteText?: string
) {
  const supabase = await db()
  const patch: TablesUpdate<"event_invites"> = { status }
  if (inviteText !== undefined) patch.invite_text = inviteText
  await supabase.from("event_invites").update(patch).eq("id", id)

  // Event-Nachbereitung: "war da" schließt den Funnel nicht — Gedächtnis-Eintrag,
  // Follow-up für morgen und ein fertiger Danke/Wie-wars-Entwurf halten den
  // Kontakt warm. Best-Effort, Statuswechsel gilt auch wenn KI hakt.
  if (status === "attended") {
    try {
      const { eventNachbereitung } = await import("@/lib/eventNachbereitung")
      await eventNachbereitung(supabase, id, eventId, { mitEntwurf: true })
    } catch {
      // Nachbereitung optional
    }
  }
  revalidatePath(`/moments/events/${eventId}`)
}

export async function removeInvite(id: string, eventId: string) {
  const supabase = await db()
  await supabase.from("event_invites").delete().eq("id", id)
  revalidatePath(`/moments/events/${eventId}`)
}

/** Individueller Promo-Code pro Einladung — Attribution im Ticketshop. */
export async function setInvitePromoCode(id: string, eventId: string, code: string | null) {
  const supabase = await db()
  await supabase.from("event_invites").update({ promo_code: code }).eq("id", id)
  revalidatePath(`/moments/events/${eventId}`)
}

// ---------- Meetups ----------
export async function createMeetup(
  input: TablesInsert<"meetups">,
  contactIds: string[]
) {
  const supabase = await db()
  const { data, error } = await supabase.from("meetups").insert(input).select("id").single()
  if (error) throw new Error(error.message)
  if (contactIds.length) {
    await supabase
      .from("meetup_participants")
      .insert(contactIds.map((contact_id) => ({ meetup_id: data.id, contact_id })))
  }
  revalidatePath("/moments/meetups")
  return data.id
}

export async function updateMeetup(id: string, input: TablesUpdate<"meetups">) {
  const supabase = await db()
  const { error } = await supabase.from("meetups").update(input).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath(`/moments/meetups/${id}`)
  revalidatePath("/moments/meetups")
}

export async function deleteMeetup(id: string) {
  const supabase = await db()
  await supabase.from("meetups").delete().eq("id", id)
  revalidatePath("/moments/meetups")
}

export async function setMeetupParticipantRsvp(
  id: string,
  meetupId: string,
  rsvp: Enums<"event_invite_status">
) {
  const supabase = await db()
  await supabase.from("meetup_participants").update({ rsvp }).eq("id", id)
  revalidatePath(`/moments/meetups/${meetupId}`)
}

/** Meetup abschließen: Recap wird als Gedächtnis-Eintrag bei allen Teilnehmern gespeichert. */
export async function finishMeetup(id: string, recap: string) {
  const supabase = await db()
  await supabase.from("meetups").update({ status: "happened", recap }).eq("id", id)
  if (recap.trim()) {
    const { data: parts } = await supabase
      .from("meetup_participants")
      .select("contact_id")
      .eq("meetup_id", id)
    if (parts?.length) {
      await supabase.from("memories").insert(
        parts.map((p) => ({
          contact_id: p.contact_id,
          kind: "fact" as const,
          content: `Treffen: ${recap}`,
        }))
      )
    }
  }
  revalidatePath(`/moments/meetups/${id}`)
  revalidatePath("/moments/meetups")
}

/**
 * Meetup-Broadcast an Telegram-Teilnehmer über die Queue.
 * Legt pro Teilnehmer mit Telegram-Kanal einen freigabepflichtigen Entwurf an.
 */
export async function queueMeetupTelegram(
  meetupId: string,
  contactIds: string[],
  text: string
) {
  const supabase = await db()
  if (!text.trim() || !contactIds.length) return 0
  const rows: TablesInsert<"suggestions">[] = contactIds.map((contact_id) => ({
    contact_id,
    situation: "Meetup-Einladung",
    variants: { einladung: text } as Json,
    chosen_variant: "einladung",
    channel: "telegram",
    status: "draft",
  }))
  const { error } = await supabase.from("suggestions").insert(rows)
  if (error) throw new Error(error.message)
  revalidatePath(`/moments/meetups/${meetupId}`)
  revalidatePath("/queue")
  return rows.length
}

// ---------- Assets ----------
export async function addAsset(input: TablesInsert<"moment_assets">) {
  const supabase = await db()
  const { error } = await supabase.from("moment_assets").insert(input)
  if (error) throw new Error(error.message)
  revalidatePath("/moments")
  if (input.contact_id) revalidatePath(`/contacts/${input.contact_id}`)
}

export async function deleteAsset(id: string) {
  const supabase = await db()
  const { data: row } = await supabase.from("moment_assets").select("content").eq("id", id).maybeSingle()
  await supabase.from("moment_assets").delete().eq("id", id)
  await removeStorageObjectByUrl(row?.content)
  revalidatePath("/moments")
}

// ---------- Occasions ----------
export async function addOccasion(input: TablesInsert<"occasions">) {
  const supabase = await db()
  const { error } = await supabase.from("occasions").insert(input)
  if (error) throw new Error(error.message)
  revalidatePath("/moments")
}

export async function deleteOccasion(id: string) {
  const supabase = await db()
  await supabase.from("occasions").delete().eq("id", id)
  revalidatePath("/moments")
}

// ---------- Asset-Versand-Log (Bild-Archiv: wohin wurde was geschickt) ----------
export async function logAssetSend(input: {
  assetId: string
  contactId?: string | null
  channel: string
  note?: string
}) {
  const supabase = await db()
  const { error } = await supabase.from("asset_sends").insert({
    asset_id: input.assetId,
    contact_id: input.contactId ?? null,
    channel: input.channel,
    note: input.note ?? null,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/moments/archive")
}

// ---------- Promo-Checkliste ----------

export async function createPromoChecklist(eventId: string) {
  const supabase = await db()
  const [{ data: event }, { count }] = await Promise.all([
    supabase.from("events").select("starts_at").eq("id", eventId).maybeSingle(),
    supabase
      .from("event_promo_tasks")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
  ])
  if (!event?.starts_at) throw new Error("Event braucht erst ein Datum")
  if (count) return // schon angelegt — nichts doppeln
  const { promoAufgaben } = await import("@/lib/promo")
  const rows = promoAufgaben(event.starts_at).map((t) => ({ ...t, event_id: eventId }))
  const { error } = await supabase.from("event_promo_tasks").insert(rows)
  if (error) throw new Error(error.message)
  revalidatePath(`/moments/events/${eventId}`)
}

export async function togglePromoTask(id: string, eventId: string, done: boolean) {
  const supabase = await db()
  const { error } = await supabase
    .from("event_promo_tasks")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath(`/moments/events/${eventId}`)
}

// ---------- Einladungs-Assistent (R30) ----------

/**
 * Welle einladen, optional gleich personalisierte Entwürfe in die Queue legen.
 * Entwürfe sind deterministisch (Vorlage + RSVP-Link) — gesendet wird wie
 * überall nur von Hand bzw. per Einzelfreigabe in der Queue.
 */
export async function inviteWaveWithDrafts(
  eventId: string,
  contactIds: string[],
  wave: number,
  mitEntwuerfen: boolean
): Promise<{ invited: number; drafts: number }> {
  if (!contactIds.length) return { invited: 0, drafts: 0 }
  const supabase = await db()

  const { error } = await supabase.from("event_invites").insert(
    contactIds.map((contact_id) => ({
      event_id: eventId,
      contact_id,
      wave: Math.min(9, Math.max(1, Math.round(wave))),
    }))
  )
  if (error) throw new Error(error.message)

  let drafts = 0
  if (mitEntwuerfen) {
    const [{ data: event }, { data: invites }] = await Promise.all([
      supabase.from("events").select("title, starts_at, location").eq("id", eventId).single(),
      supabase
        .from("event_invites")
        .select("rsvp_token, contact_id, contacts(name, language)")
        .eq("event_id", eventId)
        .in("contact_id", contactIds),
    ])
    if (event && invites?.length) {
      const { ladeVorlagen, waehleVorlage, buildInviteFromVorlage } = await import("@/lib/inviteTemplates")
      const { SITE_URL } = await import("@/lib/siteUrl")
      // Vorlagen aus der DB (Editor /vorlagen); gibt es A und B, wechseln sich
      // die Varianten ab und template_variant hält fest, wer was bekam — die
      // Antwortquote je Variante steht dann im Editor (A/B-Test).
      const vorlagen = await ladeVorlagen(supabase)
      const mitKontakt = invites.filter((i) => i.contacts)
      const rows = mitKontakt.map((i, idx) => {
        const lang: "de" | "en" = i.contacts!.language === "en" ? "en" : "de"
        const vorlage = waehleVorlage(vorlagen, "einladung", lang, idx)
        return {
          suggestion: {
            contact_id: i.contact_id,
            situation: `Event-Einladung: ${event.title}`,
            channel: "manual",
            status: "draft" as const,
            variants: {
              einladung: buildInviteFromVorlage(
                vorlage,
                { name: i.contacts!.name, language: i.contacts!.language },
                event,
                `${SITE_URL}/einladung/${i.rsvp_token}`
              ),
            },
          },
          contactId: i.contact_id,
          variant: vorlage.variant,
        }
      })
      if (rows.length) {
        const { error: sErr } = await supabase.from("suggestions").insert(rows.map((r) => r.suggestion))
        if (!sErr) {
          drafts = rows.length
          await Promise.all(
            rows.map((r) =>
              supabase
                .from("event_invites")
                .update({ template_variant: r.variant })
                .eq("event_id", eventId)
                .eq("contact_id", r.contactId)
            )
          )
        }
      }
    }
  }

  revalidatePath(`/moments/events/${eventId}`)
  revalidatePath("/queue")
  return { invited: contactIds.length, drafts }
}

/**
 * Nachfass-Entwürfe für alle, die seit mindestens 3 Tagen nicht geantwortet
 * haben. last_nudge_at verhindert, dass derselbe Gast mehrfach hintereinander
 * einen Reminder-Entwurf bekommt.
 */
export async function nudgeUnanswered(eventId: string): Promise<{ drafts: number }> {
  const supabase = await db()
  const grenze = new Date(Date.now() - 3 * 86400_000).toISOString()
  const nudgeSperre = new Date(Date.now() - 4 * 86400_000).toISOString()

  const [{ data: event }, { data: invites }] = await Promise.all([
    supabase.from("events").select("title, starts_at, location").eq("id", eventId).single(),
    supabase
      .from("event_invites")
      .select("id, rsvp_token, contact_id, created_at, last_nudge_at, contacts(name, language)")
      .eq("event_id", eventId)
      .in("status", ["invited", "no_reply"])
      .lt("created_at", grenze),
  ])
  if (!event) throw new Error("Event nicht gefunden")

  const faellig = (invites ?? []).filter(
    (i) => i.contacts && (!i.last_nudge_at || i.last_nudge_at < nudgeSperre)
  )
  if (!faellig.length) return { drafts: 0 }

  const { ladeVorlagen, waehleVorlage, buildInviteFromVorlage } = await import("@/lib/inviteTemplates")
  const { SITE_URL } = await import("@/lib/siteUrl")
  const vorlagen = await ladeVorlagen(supabase)
  const { error } = await supabase.from("suggestions").insert(
    faellig.map((i, idx) => {
      const lang: "de" | "en" = i.contacts!.language === "en" ? "en" : "de"
      return {
        contact_id: i.contact_id,
        situation: `Event-Nachfass: ${event.title}`,
        channel: "manual",
        status: "draft" as const,
        variants: {
          nachfass: buildInviteFromVorlage(
            waehleVorlage(vorlagen, "nachfass", lang, idx),
            { name: i.contacts!.name, language: i.contacts!.language },
            event,
            `${SITE_URL}/einladung/${i.rsvp_token}`
          ),
        },
      }
    })
  )
  if (error) throw new Error(error.message)

  const jetzt = new Date().toISOString()
  await supabase
    .from("event_invites")
    .update({ last_nudge_at: jetzt })
    .in("id", faellig.map((i) => i.id))

  revalidatePath(`/moments/events/${eventId}`)
  revalidatePath("/queue")
  return { drafts: faellig.length }
}

// ---------- R31: Segmente, Wächter, Chat-Zusagen, Klonen, Türsteher, Vorlagen ----------

/** Aktuelle Auswahl als wiederverwendbares Gäste-Segment speichern. */
export async function saveGuestSegment(name: string, contactIds: string[]) {
  const supabase = await db()
  const n = name.trim().slice(0, 60)
  if (!n || !contactIds.length) throw new Error("Name und Auswahl nötig")
  const { error } = await supabase
    .from("guest_segments")
    .insert({ name: n, contact_ids: contactIds })
  if (error) throw new Error(error.message)
  revalidatePath("/moments/events")
}

export async function deleteGuestSegment(id: string) {
  const supabase = await db()
  await supabase.from("guest_segments").delete().eq("id", id)
  revalidatePath("/moments/events")
}

/**
 * Wellen-Vorschlag des Wächters übernehmen: lädt die vorgeschlagenen Kontakte
 * ein (mit Entwürfen in der Queue) und markiert den Vorschlag als angenommen.
 */
export async function acceptWaveProposal(proposalId: string): Promise<{ invited: number; drafts: number }> {
  const supabase = await db()
  const { data: p } = await supabase
    .from("event_wave_proposals")
    .select("id, event_id, wave, contact_ids")
    .eq("id", proposalId)
    .is("accepted_at", null)
    .is("dismissed_at", null)
    .maybeSingle()
  if (!p) throw new Error("Vorschlag nicht mehr offen")

  // Inzwischen Eingeladene rausfiltern — der Vorschlag kann Tage alt sein
  const { data: schon } = await supabase
    .from("event_invites")
    .select("contact_id")
    .eq("event_id", p.event_id)
    .in("contact_id", p.contact_ids)
  const schonIds = new Set((schon ?? []).map((s) => s.contact_id))
  const frisch = p.contact_ids.filter((id) => !schonIds.has(id))

  const res = frisch.length
    ? await inviteWaveWithDrafts(p.event_id, frisch, p.wave, true)
    : { invited: 0, drafts: 0 }
  await supabase
    .from("event_wave_proposals")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", p.id)
  revalidatePath(`/moments/events/${p.event_id}/einladen`)
  return res
}

export async function dismissWaveProposal(proposalId: string) {
  const supabase = await db()
  const { data: p } = await supabase
    .from("event_wave_proposals")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", proposalId)
    .select("event_id")
    .maybeSingle()
  if (p) revalidatePath(`/moments/events/${p.event_id}/einladen`)
}

/**
 * Chat-Zusagen-Vermutung bestätigen oder verwerfen. Übernehmen setzt den
 * Status (yes/no), Verwerfen löscht nur die Vermutung — nie automatisch.
 */
export async function bestaetigeChatVermutung(
  inviteId: string,
  eventId: string,
  uebernehmen: boolean
) {
  const supabase = await db()
  const { data: invite } = await supabase
    .from("event_invites")
    .select("suggested_status")
    .eq("id", inviteId)
    .maybeSingle()
  if (!invite?.suggested_status) return

  const patch: TablesUpdate<"event_invites"> = {
    suggested_status: null,
    suggested_quote: null,
    suggested_at: null,
  }
  if (uebernehmen && ["yes", "no"].includes(invite.suggested_status)) {
    patch.status = invite.suggested_status as Enums<"event_invite_status">
  }
  await supabase.from("event_invites").update(patch).eq("id", inviteId)
  revalidatePath(`/moments/events/${eventId}`)
  revalidatePath(`/moments/events/${eventId}/einladen`)
}

/**
 * Event klonen: Stammdaten + neu terminierter Promo-Fahrplan (+28 Tage, wenn
 * das Original ein Datum hat) und ein Gästelisten-Vorschlag aus allen, die
 * beim Original zugesagt hatten oder da waren.
 */
export async function cloneEvent(eventId: string): Promise<string> {
  const supabase = await db()
  const { data: alt } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle()
  if (!alt) throw new Error("Event nicht gefunden")

  const neuStart = alt.starts_at
    ? new Date(new Date(alt.starts_at).getTime() + 28 * 86400_000).toISOString()
    : null
  const { data: neu, error } = await supabase
    .from("events")
    .insert({
      title: alt.title,
      starts_at: neuStart,
      location: alt.location,
      description: alt.description,
      audience: alt.audience,
      capacity: alt.capacity,
      target_attendees: alt.target_attendees,
      ticket_price_cents: alt.ticket_price_cents,
      other_costs_cents: alt.other_costs_cents,
      series_name: alt.series_name,
    })
    .select("id")
    .single()
  if (error || !neu) throw new Error(error?.message ?? "Klonen fehlgeschlagen")

  if (neuStart) {
    const { promoAufgaben } = await import("@/lib/promo")
    const rows = promoAufgaben(neuStart).map((t) => ({ ...t, event_id: neu.id }))
    if (rows.length) await supabase.from("event_promo_tasks").insert(rows)
  }

  const { data: gaeste } = await supabase
    .from("event_invites")
    .select("contact_id")
    .eq("event_id", eventId)
    .in("status", ["yes", "ticket", "attended"])
  const ids = [...new Set((gaeste ?? []).map((g) => g.contact_id))]
  if (ids.length) {
    await supabase.from("event_wave_proposals").insert({
      event_id: neu.id,
      wave: 1,
      contact_ids: ids,
      reason: `waren bei „${alt.title}" dabei oder hatten zugesagt`,
    })
  }

  revalidatePath("/moments/events")
  return neu.id
}

/** Vorlage speichern (Editor /vorlagen). Leerer Text deaktiviert die Variante. */
export async function saveTemplate(input: {
  key: string
  lang: string
  variant: string
  text: string
}) {
  const supabase = await db()
  const key = input.key.trim()
  const lang = input.lang === "en" ? "en" : "de"
  const variant = input.variant === "B" ? "B" : "A"
  const text = input.text.trim().slice(0, 1000)
  const { error } = await supabase
    .from("templates")
    .upsert(
      { key, lang, variant, text: text || " ", active: !!text, updated_at: new Date().toISOString() },
      { onConflict: "key,lang,variant" }
    )
  if (error) throw new Error(error.message)
  revalidatePath("/vorlagen")
}
