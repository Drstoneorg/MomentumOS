import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  extractContactFromImage,
  extractContactFromText,
  type CapturedContact,
} from "@/lib/ai/extractContactData"
import { CHANNELS } from "@/lib/channels"
import { suggestIntent } from "@/lib/scoring"

export const maxDuration = 60

const normPhone = (h: string) => h.replace(/[^\d]/g, "").slice(-9) // letzte 9 Ziffern als Vergleichsbasis

/**
 * Universal-Kontakterfassung: Bild (Visitenkarte/Screenshot/Foto) oder Freitext rein,
 * Kontakt + Kanäle raus. Dedupe über Kanal-Handle (Nummer/E-Mail/Handle) und Namen —
 * Treffer wird aktualisiert statt doppelt angelegt.
 * Body: { image?: dataUrl, text?: string }
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { image, text } = (await req.json()) as { image?: string; text?: string }
  if (!image && !text?.trim()) {
    return NextResponse.json({ error: "Bild oder Text nötig" }, { status: 400 })
  }

  try {
    const p: CapturedContact = image
      ? await extractContactFromImage(image)
      : await extractContactFromText(text!)

    // Nur Kanäle aus der Registry übernehmen
    const channels = p.channels.filter((c) => CHANNELS[c.channel])

    // --- Dedupe: 1) Kanal-Handle (Nummer/E-Mail exakt bzw. Telefon-Suffix), 2) Name exakt ---
    let contactId: string | null = null
    if (channels.length) {
      const { data: allChannels } = await supabase
        .from("contact_channels")
        .select("contact_id, channel, handle")
      for (const existing of allChannels ?? []) {
        for (const c of channels) {
          const isPhone = ["whatsapp", "sms", "signal"].includes(c.channel)
          const same = isPhone
            ? normPhone(existing.handle) !== "" && normPhone(existing.handle) === normPhone(c.handle)
            : existing.handle.trim().toLowerCase() === c.handle.trim().toLowerCase()
          if (same) {
            contactId = existing.contact_id
            break
          }
        }
        if (contactId) break
      }
    }
    if (!contactId && p.name !== "Unbekannt") {
      const { data: byName } = await supabase
        .from("contacts")
        .select("id")
        .ilike("name", p.name)
        .limit(1)
        .maybeSingle()
      if (byName) contactId = byName.id
    }

    const isNew = !contactId
    const tags = p.tags.length ? p.tags : p.kind !== "dating" && p.kind !== "unbekannt" ? [p.kind] : []
    const notes = [p.notes, p.company ? `Firma/Rolle: ${p.company}` : null]
      .filter(Boolean)
      .join(" · ")

    if (contactId) {
      // Nur leere Felder auffüllen, nichts überschreiben
      const { data: cur } = await supabase.from("contacts").select("*").eq("id", contactId).single()
      await supabase
        .from("contacts")
        .update({
          age: cur?.age ?? p.age ?? undefined,
          location: cur?.location ?? p.location ?? undefined,
          birthday: cur?.birthday ?? p.birthday ?? undefined,
          bio: cur?.bio ?? p.bio ?? undefined,
          interests: cur?.interests?.length ? undefined : p.interests.length ? p.interests : undefined,
          notes: cur?.notes ? (notes ? `${cur.notes} · ${notes}` : undefined) : notes || undefined,
          relationship_tags: cur?.relationship_tags?.length ? undefined : tags.length ? tags : undefined,
        })
        .eq("id", contactId)
    } else {
      // Nicht-Dating-Kontakte: stage "chatting" hält sie aus "Neue Matches" raus,
      // Geburtstags-/Moments-Crons erfassen sie trotzdem (nur "archived" wird ignoriert).
      const { data: created, error } = await supabase
        .from("contacts")
        .insert({
          name: p.name,
          platform: "import",
          age: p.age,
          location: p.location,
          language: p.language,
          birthday: p.birthday,
          bio: p.bio,
          interests: p.interests,
          notes: notes || null,
          relationship_tags: tags,
          pipeline_stage: p.kind === "dating" ? "new_match" : "chatting",
          // Dating-Erfassungen in die Matchbox, alles andere (Freunde, Business …) zu MomentOS
          realm: p.kind === "dating" ? "match" : "moment",
          // Auto-Triage: kein Alt/Goth/Aesthetic-Signal = Event-Lead-Vorschlag
          intent:
            p.kind === "dating"
              ? suggestIntent({ bio: p.bio, interests: p.interests, notes: notes || null })
              : "date",
        })
        .select("id")
        .single()
      if (error || !created) throw new Error(error?.message ?? "Anlegen fehlgeschlagen")
      contactId = created.id
    }

    // Kanäle anlegen (vorhandene handle+channel überspringen)
    const { data: existingCh } = await supabase
      .from("contact_channels")
      .select("channel, handle")
      .eq("contact_id", contactId)
    const seen = new Set((existingCh ?? []).map((c) => `${c.channel}|${c.handle.toLowerCase()}`))
    const fresh = channels.filter((c) => !seen.has(`${c.channel}|${c.handle.toLowerCase()}`))
    if (fresh.length) {
      await supabase.from("contact_channels").insert(
        fresh.map((c, i) => ({
          contact_id: contactId!,
          channel: c.channel,
          handle: c.handle,
          is_primary: (existingCh?.length ?? 0) === 0 && i === 0,
        }))
      )
    }

    return NextResponse.json({
      contactId,
      name: p.name,
      isNew,
      kind: p.kind,
      birthday: p.birthday,
      channels: [...(existingCh ?? []), ...fresh],
      addedChannels: fresh.length,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erfassungs-Fehler" },
      { status: 500 }
    )
  }
}
