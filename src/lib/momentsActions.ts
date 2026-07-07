"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { Enums, TablesInsert, TablesUpdate } from "@/lib/database.types"

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
  revalidatePath(`/moments/events/${eventId}`)
}

export async function removeInvite(id: string, eventId: string) {
  const supabase = await db()
  await supabase.from("event_invites").delete().eq("id", id)
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
  await supabase.from("moment_assets").delete().eq("id", id)
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
