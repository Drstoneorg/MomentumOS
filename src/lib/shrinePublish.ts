import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Event-Veröffentlichung auf Shrine (zweites Supabase-Projekt): MomentumOS ist
 * die Quelle, Shrine das öffentliche Schaufenster mit Eventkalender. Läuft über
 * den Service-Key des Shrine-Projekts — ohne SHRINE_SERVICE_ROLE_KEY zeigt die
 * Event-Seite nur einen Hinweis, was fehlt (gleiche Mechanik wie shrineTools).
 *
 * Einzige Schreibstelle Richtung Shrine. Es wird NIE automatisch veröffentlicht —
 * jede Übertragung ist ein Klick des Users auf der Event-Seite.
 */

const SHRINE_URL = process.env.SHRINE_SUPABASE_URL ?? "https://pfzjnwboudgwqzyfrqmi.supabase.co"

export function shrineKonfiguriert(): boolean {
  return !!process.env.SHRINE_SERVICE_ROLE_KEY
}

let cached: SupabaseClient | null = null
function shrine(): SupabaseClient {
  if (!cached) {
    const key = process.env.SHRINE_SERVICE_ROLE_KEY
    if (!key) throw new Error("SHRINE_SERVICE_ROLE_KEY fehlt")
    cached = createClient(SHRINE_URL, key, { auth: { persistSession: false } })
  }
  return cached
}

export type ShrineProfil = { id: string; username: string; display_name: string | null }

/** Profile fürs „Veröffentlichen als“-Dropdown (das Event braucht einen Ersteller). */
export async function listShrineProfiles(): Promise<ShrineProfil[]> {
  const { data, error } = await shrine()
    .from("shrine_profiles")
    .select("id, username, display_name")
    .order("created_at")
    .limit(50)
  if (error) throw new Error(error.message)
  return data ?? []
}

export type PublishInput = {
  title: string
  description: string | null
  location: string | null
  starts_at: string
  ticket_url: string | null
}

/**
 * Insert oder Update auf shrine_events. Feldgrenzen kommen aus den
 * Shrine-Constraints (Titel 3–120, Beschreibung ≤2000, Ort ≤200, URL ≤500).
 */
export async function publishEventToShrine(
  input: PublishInput,
  creatorProfileId: string,
  shrineEventId: string | null
): Promise<string> {
  const titel = input.title.trim().slice(0, 120)
  if (titel.length < 3) throw new Error("Titel braucht mindestens 3 Zeichen")
  const row = {
    title: titel,
    description: (input.description ?? "").slice(0, 2000),
    location: (input.location ?? "").slice(0, 200),
    url: (input.ticket_url ?? "").slice(0, 500),
    starts_at: input.starts_at,
  }

  if (shrineEventId) {
    const { data, error } = await shrine()
      .from("shrine_events")
      .update(row)
      .eq("id", shrineEventId)
      .select("id")
      .maybeSingle()
    if (error) throw new Error(error.message)
    // Auf Shrine von Hand gelöscht? Dann neu anlegen statt ins Leere zu schreiben.
    if (data?.id) return data.id
  }

  const { data, error } = await shrine()
    .from("shrine_events")
    .insert({ ...row, creator_id: creatorProfileId })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

export async function unpublishEventFromShrine(shrineEventId: string): Promise<void> {
  const { error } = await shrine().from("shrine_events").delete().eq("id", shrineEventId)
  if (error) throw new Error(error.message)
}
