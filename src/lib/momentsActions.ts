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
      const [{ data: invite }, { data: event }] = await Promise.all([
        supabase.from("event_invites").select("contact_id").eq("id", id).single(),
        supabase.from("events").select("title, starts_at").eq("id", eventId).single(),
      ])
      if (invite && event) {
        const dateStr = event.starts_at
          ? new Date(event.starts_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
          : null
        await supabase.from("memories").insert({
          contact_id: invite.contact_id,
          kind: "fact",
          content: `War bei meinem Event „${event.title}“${dateStr ? ` (${dateStr})` : ""} — persönlich getroffen`,
        })
        const { data: openFu } = await supabase
          .from("followups")
          .select("id")
          .eq("contact_id", invite.contact_id)
          .eq("done", false)
          .ilike("reason", `%${event.title}%`)
          .limit(1)
          .maybeSingle()
        if (!openFu) {
          const due = new Date()
          due.setDate(due.getDate() + 1)
          due.setHours(10, 0, 0, 0)
          await supabase.from("followups").insert({
            contact_id: invite.contact_id,
            due_at: due.toISOString(),
            reason: `Nach Event „${event.title}“ anschreiben — war da 🎉`,
          })
        }
        const { data: openDraft } = await supabase
          .from("suggestions")
          .select("id")
          .eq("contact_id", invite.contact_id)
          .in("status", ["draft", "approved"])
          .limit(1)
          .maybeSingle()
        if (!openDraft) {
          const { loadContactContext } = await import("@/lib/ai/context")
          const { generateReplies } = await import("@/lib/ai/generateReplies")
          const ctx = await loadContactContext(invite.contact_id, supabase)
          if (ctx) {
            const reply = await generateReplies(
              ctx,
              `Die Person war bei meinem Event „${event.title}“ und wir haben uns dort persönlich getroffen. Schreibe eine lockere Nachfass-Nachricht: freut mich dass du da warst, wie fandest du es. Kein Marketing, kein Ticket-Gerede, einfach warm und persönlich.`
            )
            await supabase.from("suggestions").insert({
              contact_id: invite.contact_id,
              situation: `Event-Nachbereitung „${event.title}“ (war da)`,
              variants: reply.variants,
              channel: "manual",
              status: "draft",
            })
          }
        }
      }
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
      const { buildInviteMessage } = await import("@/lib/inviteTemplates")
      const { SITE_URL } = await import("@/lib/siteUrl")
      const rows = invites
        .filter((i) => i.contacts)
        .map((i) => ({
          contact_id: i.contact_id,
          situation: `Event-Einladung: ${event.title}`,
          channel: "manual",
          status: "draft" as const,
          variants: {
            einladung: buildInviteMessage(
              { name: i.contacts!.name, language: i.contacts!.language },
              event,
              "einladung",
              `${SITE_URL}/einladung/${i.rsvp_token}`
            ),
          },
        }))
      if (rows.length) {
        const { error: sErr } = await supabase.from("suggestions").insert(rows)
        if (!sErr) drafts = rows.length
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

  const { buildInviteMessage } = await import("@/lib/inviteTemplates")
  const { SITE_URL } = await import("@/lib/siteUrl")
  const { error } = await supabase.from("suggestions").insert(
    faellig.map((i) => ({
      contact_id: i.contact_id,
      situation: `Event-Nachfass: ${event.title}`,
      channel: "manual",
      status: "draft" as const,
      variants: {
        nachfass: buildInviteMessage(
          { name: i.contacts!.name, language: i.contacts!.language },
          event,
          "nachfass",
          `${SITE_URL}/einladung/${i.rsvp_token}`
        ),
      },
    }))
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
