"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  publishEventToShrine,
  unpublishEventFromShrine,
  shrineKonfiguriert,
} from "@/lib/shrinePublish"

/**
 * Server-Actions rund ums Shrine-Publishing. Veröffentlichen ist immer ein
 * bewusster Klick — nichts geht automatisch raus.
 */

async function db() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Nicht angemeldet")
  return supabase
}

export async function setShrinePublishProfile(profileId: string): Promise<void> {
  const supabase = await db()
  await supabase
    .from("settings")
    .upsert({ key: "shrine_publish_profile", value: profileId }, { onConflict: "key" })
}

export async function saveEventTicketUrl(eventId: string, url: string): Promise<void> {
  const supabase = await db()
  const { error } = await supabase
    .from("events")
    .update({ ticket_url: url.trim() || null })
    .eq("id", eventId)
  if (error) throw new Error(error.message)
  revalidatePath(`/moments/events/${eventId}`)
}

export async function publishToShrine(eventId: string): Promise<{ error?: string }> {
  if (!shrineKonfiguriert()) return { error: "SHRINE_SERVICE_ROLE_KEY fehlt (Vercel → Env)" }
  const supabase = await db()
  const [{ data: event }, { data: profilRow }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, description, location, starts_at, ticket_url, shrine_event_id")
      .eq("id", eventId)
      .maybeSingle(),
    supabase.from("settings").select("value").eq("key", "shrine_publish_profile").maybeSingle(),
  ])
  if (!event) return { error: "Event nicht gefunden" }
  if (!event.starts_at) return { error: "Event braucht erst ein Datum" }
  const profileId = typeof profilRow?.value === "string" ? profilRow.value : ""
  if (!profileId) return { error: "Erst ein Shrine-Profil als Ersteller wählen" }

  try {
    const shrineId = await publishEventToShrine(
      {
        title: event.title,
        description: event.description,
        location: event.location,
        starts_at: event.starts_at,
        ticket_url: event.ticket_url,
      },
      profileId,
      event.shrine_event_id
    )
    const { error } = await supabase
      .from("events")
      .update({ shrine_event_id: shrineId, shrine_published_at: new Date().toISOString() })
      .eq("id", eventId)
    if (error) return { error: error.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Veröffentlichen fehlgeschlagen" }
  }
  revalidatePath(`/moments/events/${eventId}`)
  return {}
}

export async function unpublishFromShrine(eventId: string): Promise<{ error?: string }> {
  if (!shrineKonfiguriert()) return { error: "SHRINE_SERVICE_ROLE_KEY fehlt (Vercel → Env)" }
  const supabase = await db()
  const { data: event } = await supabase
    .from("events")
    .select("shrine_event_id")
    .eq("id", eventId)
    .maybeSingle()
  if (!event?.shrine_event_id) return { error: "Event ist nicht auf Shrine" }
  try {
    await unpublishEventFromShrine(event.shrine_event_id)
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Entfernen fehlgeschlagen" }
  }
  const { error } = await supabase
    .from("events")
    .update({ shrine_event_id: null, shrine_published_at: null })
    .eq("id", eventId)
  if (error) return { error: error.message }
  revalidatePath(`/moments/events/${eventId}`)
  return {}
}
