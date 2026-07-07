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

export async function createContact(input: TablesInsert<"contacts">) {
  const supabase = await db()
  const { data, error } = await supabase
    .from("contacts")
    .insert(input)
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  revalidatePath("/contacts")
  return data.id
}

export async function updateContact(
  id: string,
  input: TablesUpdate<"contacts">
) {
  const supabase = await db()
  const { error } = await supabase.from("contacts").update(input).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath(`/contacts/${id}`)
  revalidatePath("/contacts")
  revalidatePath("/pipeline")
}

export async function deleteContact(id: string) {
  const supabase = await db()
  const { error } = await supabase.from("contacts").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/contacts")
}

export async function addMessage(input: TablesInsert<"messages">) {
  const supabase = await db()
  const { error } = await supabase.from("messages").insert(input)
  if (error) throw new Error(error.message)
  await supabase
    .from("contacts")
    .update({
      last_contact_at: new Date().toISOString(),
      last_contact_initiator: input.direction === "out" ? "me" : "them",
    })
    .eq("id", input.contact_id)
  revalidatePath(`/contacts/${input.contact_id}`)
}

export async function importChat(
  contactId: string,
  text: string,
  channel: string
) {
  // Format: Zeilen mit "ich:" = ausgehend, alles andere = eingehend.
  const supabase = await db()
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  const rows: TablesInsert<"messages">[] = []
  const base = Date.now() - lines.length * 1000
  lines.forEach((line, i) => {
    const isOut = /^(ich|me|you)\s*[:>-]/i.test(line)
    const content = line.replace(/^[^:>-]{0,20}[:>-]\s*/, "") || line
    rows.push({
      contact_id: contactId,
      direction: isOut ? "out" : "in",
      channel,
      content,
      source: "import",
      sent_at: new Date(base + i * 1000).toISOString(),
    })
  })
  if (rows.length) {
    const { error } = await supabase.from("messages").insert(rows)
    if (error) throw new Error(error.message)
  }
  revalidatePath(`/contacts/${contactId}`)
  return rows.length
}

export async function addMemory(input: TablesInsert<"memories">) {
  const supabase = await db()
  const { error } = await supabase.from("memories").insert(input)
  if (error) throw new Error(error.message)
  revalidatePath(`/contacts/${input.contact_id}`)
}

export async function deleteMemory(id: string, contactId: string) {
  const supabase = await db()
  const { error } = await supabase.from("memories").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath(`/contacts/${contactId}`)
}

export async function addChannel(input: TablesInsert<"contact_channels">) {
  const supabase = await db()
  const { error } = await supabase.from("contact_channels").insert(input)
  if (error) throw new Error(error.message)
  revalidatePath(`/contacts/${input.contact_id}`)
}

export async function addFollowup(input: TablesInsert<"followups">) {
  const supabase = await db()
  const { error } = await supabase.from("followups").insert(input)
  if (error) throw new Error(error.message)
  revalidatePath(`/contacts/${input.contact_id}`)
  revalidatePath("/")
}

export async function completeFollowup(id: string) {
  const supabase = await db()
  const { error } = await supabase
    .from("followups")
    .update({ done: true })
    .eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/")
}

export async function addDate(input: TablesInsert<"dates">) {
  const supabase = await db()
  const { error } = await supabase.from("dates").insert(input)
  if (error) throw new Error(error.message)
  await supabase
    .from("contacts")
    .update({ pipeline_stage: "date_planned" })
    .eq("id", input.contact_id)
  revalidatePath(`/contacts/${input.contact_id}`)
  revalidatePath("/")
}

export async function setStage(
  contactId: string,
  stage: Enums<"pipeline_stage">
) {
  await updateContact(contactId, { pipeline_stage: stage })
}

export async function updateSuggestion(
  id: string,
  input: TablesUpdate<"suggestions">
) {
  const supabase = await db()
  const { error } = await supabase.from("suggestions").update(input).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/queue")
}

export async function markSuggestionSent(id: string) {
  const supabase = await db()
  const { data: s } = await supabase
    .from("suggestions")
    .select("contact_id, channel, chosen_variant, variants")
    .eq("id", id)
    .single()
  if (!s) throw new Error("Suggestion nicht gefunden")
  const variants = (s.variants ?? {}) as Record<string, string>
  const text = s.chosen_variant ? variants[s.chosen_variant] : null
  if (!text) throw new Error("Keine Variante gewählt")

  await supabase
    .from("suggestions")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
  await supabase.from("messages").insert({
    contact_id: s.contact_id,
    direction: "out",
    channel: s.channel,
    content: text,
    source: "manual",
  })
  revalidatePath("/queue")
  revalidatePath(`/contacts/${s.contact_id}`)
}

export async function saveSetting(key: string, value: string) {
  const supabase = await db()
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
  revalidatePath("/settings")
}
