"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { isRecruitStage } from "@/lib/recruit"

async function authedClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? supabase : null
}

export async function setRecruitStage(
  contactId: string,
  stage: string
): Promise<{ error?: string }> {
  const supabase = await authedClient()
  if (!supabase) return { error: "nicht angemeldet" }
  if (!isRecruitStage(stage)) return { error: "unbekannte Stufe" }
  const { error } = await supabase
    .from("contacts")
    .update({ recruit_stage: stage, updated_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("realm", "recruit")
  if (error) return { error: error.message }
  revalidatePath("/recruit")
  return {}
}

export async function addRecruitContact(input: {
  name: string
  instagram?: string
  city?: string
}): Promise<{ error?: string }> {
  const supabase = await authedClient()
  if (!supabase) return { error: "nicht angemeldet" }
  const name = input.name?.trim()
  if (!name) return { error: "Name fehlt" }
  const handle = input.instagram?.trim().replace(/^@/, "") || null
  const { error } = await supabase.from("contacts").insert({
    name,
    realm: "recruit",
    recruit_stage: "scouted",
    platform: handle ? "instagram" : "manual",
    external_id: handle,
    location: input.city?.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath("/recruit")
  return {}
}

/** Bewerbung übernehmen: Kontakt im Realm "recruit" anlegen und verknüpfen. */
export async function acceptApplication(id: string): Promise<{ error?: string }> {
  const supabase = await authedClient()
  if (!supabase) return { error: "nicht angemeldet" }
  const { data: app } = await supabase
    .from("recruit_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (!app) return { error: "Bewerbung nicht gefunden" }
  if (app.contact_id) return {}

  const handle = app.instagram?.trim().replace(/^@/, "") || null
  const notes = [
    app.style ? `Stil: ${app.style}` : null,
    app.email ? `Mail: ${app.email}` : null,
    app.message ? `Bewerbung: ${app.message}` : null,
    "Quelle: Bewerbungsformular (Einwilligung liegt vor)",
  ]
    .filter(Boolean)
    .join("\n")

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      name: app.name,
      realm: "recruit",
      // Wer sich selbst bewirbt, ist schon interessiert — nicht bei "Entdeckt" starten
      recruit_stage: "interested",
      platform: handle ? "instagram" : "bewerbung",
      external_id: handle,
      location: app.city,
      notes,
    })
    .select("id")
    .single()
  if (error || !contact) return { error: error?.message ?? "Anlegen fehlgeschlagen" }

  await supabase
    .from("recruit_applications")
    .update({ status: "accepted", contact_id: contact.id })
    .eq("id", id)
  revalidatePath("/recruit")
  revalidatePath("/recruit/bewerbungen")
  return {}
}

// Form-Varianten: <form action> verlangt void-Rückgabe
export async function acceptApplicationForm(id: string): Promise<void> {
  await acceptApplication(id)
}
export async function rejectApplicationForm(id: string): Promise<void> {
  await rejectApplication(id)
}

export async function rejectApplication(id: string): Promise<{ error?: string }> {
  const supabase = await authedClient()
  if (!supabase) return { error: "nicht angemeldet" }
  const { error } = await supabase
    .from("recruit_applications")
    .update({ status: "rejected" })
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/recruit/bewerbungen")
  return {}
}
