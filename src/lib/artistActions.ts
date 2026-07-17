"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { Enums, TablesUpdate } from "@/lib/database.types"
import { nextGigStatus } from "@/lib/artists"
import { draftArtistInquiry } from "@/lib/ai/artistInquiry"

async function db() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Nicht angemeldet")
  return supabase
}

function revalidateArtist(artistId?: string) {
  revalidatePath("/book/artists")
  if (artistId) revalidatePath(`/book/artists/${artistId}`)
}

// Kommagetrennte Eingabe → sauberes text[]
function splitList(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export type NewArtistInput = {
  name: string
  artistType: Enums<"artist_type">
  genres?: string
  city?: string
}

// Fehler als { error } zurückgeben statt throw — Next maskiert Server-Action-Fehler
// in Production zu nutzlosem Digest (gleiche Lektion wie bei saveJobCv).
export async function createArtist(
  input: NewArtistInput,
): Promise<{ id?: string; error?: string }> {
  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("artists")
      .insert({
        name: input.name.trim(),
        artist_type: input.artistType,
        genres: splitList(input.genres),
        city: input.city?.trim() || null,
      })
      .select("id")
      .single()
    if (error || !data) return { error: error?.message ?? "Anlegen fehlgeschlagen" }
    revalidateArtist()
    return { id: data.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Anlegen fehlgeschlagen" }
  }
}

export async function updateArtist(id: string, patch: TablesUpdate<"artists">) {
  const supabase = await db()
  await supabase.from("artists").update(patch).eq("id", id)
  revalidateArtist(id)
}

// Genres/Links kommen aus InlineFields als Kommaliste
export async function updateArtistList(
  id: string,
  field: "genres" | "links",
  raw: string,
) {
  const supabase = await db()
  const patch: TablesUpdate<"artists"> =
    field === "genres" ? { genres: splitList(raw) } : { links: splitList(raw) }
  await supabase.from("artists").update(patch).eq("id", id)
  revalidateArtist(id)
}

export async function deleteArtist(id: string) {
  const supabase = await db()
  await supabase.from("artists").delete().eq("id", id) // Gigs fallen per Cascade mit
  revalidateArtist()
}

export type NewGigInput = {
  artistId: string
  eventId?: string | null
  title?: string
  venue?: string
  gigDate?: string | null
  setSlot?: string
  feeCents?: number | null
  notes?: string
}

export async function createGig(input: NewGigInput): Promise<{ id?: string; error?: string }> {
  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("gigs")
      .insert({
        artist_id: input.artistId,
        event_id: input.eventId || null,
        title: input.title?.trim() || null,
        venue: input.venue?.trim() || null,
        gig_date: input.gigDate || null,
        set_slot: input.setSlot?.trim() || null,
        fee_cents: input.feeCents ?? null,
        notes: input.notes?.trim() || null,
      })
      .select("id")
      .single()
    if (error || !data) return { error: error?.message ?? "Gig anlegen fehlgeschlagen" }
    revalidateArtist(input.artistId)
    return { id: data.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gig anlegen fehlgeschlagen" }
  }
}

export async function updateGig(id: string, artistId: string, patch: TablesUpdate<"gigs">) {
  const supabase = await db()
  await supabase.from("gigs").update(patch).eq("id", id)
  revalidateArtist(artistId)
}

// Schiebt den Gig einen Pipeline-Schritt weiter (idea → … → played)
export async function advanceGig(
  id: string,
  artistId: string,
  current: Enums<"gig_status">,
) {
  const next = nextGigStatus(current)
  if (!next) return
  const supabase = await db()
  await supabase.from("gigs").update({ status: next }).eq("id", id)
  revalidateArtist(artistId)
}

export async function cancelGig(id: string, artistId: string) {
  const supabase = await db()
  await supabase.from("gigs").update({ status: "cancelled" }).eq("id", id)
  revalidateArtist(artistId)
}

export async function deleteGig(id: string, artistId: string) {
  const supabase = await db()
  await supabase.from("gigs").delete().eq("id", id)
  revalidateArtist(artistId)
}

// KI-Entwurf einer Booking-Anfrage für einen Gig; wird am Gig gespeichert.
// Nur Entwurf — gesendet wird ausschließlich manuell durch den User.
export async function generateGigInquiry(
  gigId: string,
  wishes?: string,
): Promise<{ text?: string; error?: string }> {
  try {
    const supabase = await db()
    const { data: gig } = await supabase
      .from("gigs")
      .select("*, artists(*), events(title, starts_at, location)")
      .eq("id", gigId)
      .maybeSingle()
    if (!gig || !gig.artists) return { error: "Gig nicht gefunden" }

    const artist = gig.artists
    const event = gig.events
    const eventDate = gig.gig_date
      ? new Date(`${gig.gig_date}T12:00:00`).toLocaleDateString("de-DE", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : event?.starts_at
        ? new Date(event.starts_at).toLocaleDateString("de-DE", {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : null

    const draft = await draftArtistInquiry({
      artistName: artist.name,
      contactName: artist.contact_name,
      artistType: artist.artist_type,
      genres: artist.genres,
      eventTitle: gig.title ?? event?.title ?? null,
      eventDate,
      venue: gig.venue ?? event?.location ?? null,
      setSlot: gig.set_slot,
      feeCents: gig.fee_cents,
      feeNote: gig.fee_note,
      notes: gig.notes,
      wishes: wishes?.trim() || null,
    })

    const text = `Betreff: ${draft.subject}\n\n${draft.message}`
    await supabase.from("gigs").update({ inquiry_draft: text }).eq("id", gigId)
    revalidateArtist(gig.artist_id)
    return { text }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Entwurf fehlgeschlagen" }
  }
}
