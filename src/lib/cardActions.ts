"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function db() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Nicht angemeldet")
  return supabase
}

/** Lädt eine TCG-Kartenvorlage (Bild) hoch und registriert sie. */
export async function uploadCardTemplate(formData: FormData) {
  const supabase = await db()
  const file = formData.get("file") as File | null
  const name = ((formData.get("name") as string) || "").trim()
  const styleNotes = ((formData.get("style_notes") as string) || "").trim()
  if (!file || !file.size) throw new Error("Keine Datei gewählt")
  if (!name) throw new Error("Name fehlt")
  if (file.size > 8 * 1024 * 1024) throw new Error("Datei zu groß (max 8 MB)")

  const admin = createAdminClient()
  const ext = file.name.split(".").pop()?.toLowerCase() || "png"
  const path = `card-templates/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: upErr } = await admin.storage
    .from("moment-images")
    .upload(path, bytes, { contentType: file.type || "image/png", upsert: false })
  if (upErr) throw new Error(`Upload fehlgeschlagen: ${upErr.message}`)
  const { data: pub } = admin.storage.from("moment-images").getPublicUrl(path)

  const { error } = await supabase.from("card_templates").insert({
    name,
    image_url: pub.publicUrl,
    style_notes: styleNotes || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/cards")
}

export async function deleteCardTemplate(id: string) {
  const supabase = await db()
  const { error } = await supabase.from("card_templates").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/cards")
}

export async function deleteCard(assetId: string) {
  const supabase = await db()
  const { error } = await supabase.from("moment_assets").delete().eq("id", assetId)
  if (error) throw new Error(error.message)
  revalidatePath("/cards")
}
