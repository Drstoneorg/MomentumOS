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

/** Mehrere Kontakte auf einmal archivieren (Auto-Archiv-Vorwarnung im Dashboard). */
export async function archiveContacts(ids: string[]) {
  if (!ids.length) return
  const supabase = await db()
  const { error } = await supabase
    .from("contacts")
    .update({ pipeline_stage: "archived" })
    .in("id", ids)
  if (error) throw new Error(error.message)
  revalidatePath("/")
  revalidatePath("/contacts")
  revalidatePath("/pipeline")
}

/** Kontakt zwischen MatchOS (match) und MomentOS (moment) verschieben. */
export async function setContactRealm(id: string, realm: "match" | "moment") {
  const supabase = await db()
  const { error } = await supabase.from("contacts").update({ realm }).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath(`/contacts/${id}`)
  revalidatePath("/contacts")
  revalidatePath("/pipeline")
  revalidatePath("/moments")
  revalidatePath("/moments/people")
  revalidatePath("/")
}

export async function setContactIntent(id: string, intent: "date" | "event_lead" | "both") {
  const supabase = await db()
  const { error } = await supabase.from("contacts").update({ intent }).eq("id", id)
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

export async function deleteMessage(id: string, contactId: string) {
  const supabase = await db()
  const { error } = await supabase.from("messages").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath(`/contacts/${contactId}`)
}

export async function clearMessages(contactId: string) {
  const supabase = await db()
  const { error } = await supabase.from("messages").delete().eq("contact_id", contactId)
  if (error) throw new Error(error.message)
  revalidatePath(`/contacts/${contactId}`)
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

export type TasteProfile = {
  include: string[]
  avoid: string[]
  autoLikeHint: boolean
}

export async function saveTasteProfile(profile: TasteProfile) {
  const supabase = await db()
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "taste_profile", value: profile as never, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
  revalidatePath("/settings")
}

export async function saveAiBudget(monthlyLimitUsd: number, imageCostUsd?: number | null) {
  const supabase = await db()
  const limit = Math.max(0, Number(monthlyLimitUsd) || 0)
  // imageCostUsd: echter Pro-Bild-Preis aus dem OpenAI-Dashboard (Kalibrierung).
  // 0/leer = keine Kalibrierung, Token-Schätzung gilt weiter.
  const img = Number(imageCostUsd)
  const value = {
    monthlyLimitUsd: limit,
    ...(Number.isFinite(img) && img > 0 ? { imageCostUsd: img } : {}),
  }
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "ai_budget", value: value as never, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
  revalidatePath("/settings")
}

// ---------- Bulk-Import (vCard/CSV) ----------
export type ImportRow = {
  name: string
  phone?: string
  email?: string
  birthday?: string
  location?: string
  tags?: string[]
  notes?: string
}

export type ImportResult = {
  created: number
  skipped: { name: string; reason: string }[]
}

export async function bulkImportContacts(rows: ImportRow[]): Promise<ImportResult> {
  const supabase = await db()
  const result: ImportResult = { created: 0, skipped: [] }

  const { data: existing } = await supabase
    .from("contacts")
    .select("id, name, contact_channels(handle)")
  const names = new Set((existing ?? []).map((c) => c.name.trim().toLowerCase()))
  const handles = new Set(
    (existing ?? []).flatMap((c) =>
      (c.contact_channels ?? []).map((ch) => ch.handle.replace(/[\s\-()]/g, "").toLowerCase())
    )
  )

  for (const row of rows.slice(0, 500)) {
    const name = row.name?.trim()
    if (!name) {
      result.skipped.push({ name: "(leer)", reason: "kein Name" })
      continue
    }
    const phoneKey = row.phone?.replace(/[\s\-()]/g, "").toLowerCase()
    const emailKey = row.email?.trim().toLowerCase()
    if (names.has(name.toLowerCase())) {
      result.skipped.push({ name, reason: "Name existiert bereits" })
      continue
    }
    if ((phoneKey && handles.has(phoneKey)) || (emailKey && handles.has(emailKey))) {
      result.skipped.push({ name, reason: "Kanal-Handle existiert bereits" })
      continue
    }

    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({
        name,
        platform: "freund",
        realm: "moment",
        location: row.location || null,
        birthday: row.birthday || null,
        relationship_tags: row.tags ?? [],
        notes: row.notes || null,
      })
      .select("id")
      .single()
    if (error || !contact) {
      result.skipped.push({ name, reason: error?.message ?? "Insert-Fehler" })
      continue
    }

    const channels: TablesInsert<"contact_channels">[] = []
    if (row.phone) channels.push({ contact_id: contact.id, channel: "sms", handle: row.phone.trim(), is_primary: true })
    if (row.email) channels.push({ contact_id: contact.id, channel: "email", handle: row.email.trim(), is_primary: !row.phone })
    if (channels.length) await supabase.from("contact_channels").insert(channels)

    names.add(name.toLowerCase())
    if (phoneKey) handles.add(phoneKey)
    if (emailKey) handles.add(emailKey)
    result.created++
  }

  revalidatePath("/contacts")
  revalidatePath("/moments")
  return result
}

export async function bulkAddTags(contactIds: string[], tags: string[]) {
  const supabase = await db()
  const clean = tags.map((t) => t.trim()).filter(Boolean)
  if (!clean.length || !contactIds.length) return
  const { data: rows } = await supabase
    .from("contacts")
    .select("id, relationship_tags")
    .in("id", contactIds)
  for (const row of rows ?? []) {
    const merged = [...new Set([...(row.relationship_tags ?? []), ...clean])]
    await supabase.from("contacts").update({ relationship_tags: merged }).eq("id", row.id)
  }
  revalidatePath("/contacts")
  revalidatePath("/moments")
}

// ---------- JobOS: Bewerbungs-Manager ----------
import {
  extractCvProfile,
  extractJob,
  scoreJob,
  generateCoverLetter,
  generateInterviewPrep,
  type CvProfile,
  type InterviewPrep,
} from "@/lib/ai/jobs"
import { findDuplicateJob } from "@/lib/jobDedupe"

export async function loadCvProfile(): Promise<CvProfile | null> {
  const supabase = await db()
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "job_cv_profile")
    .maybeSingle()
  return (data?.value as CvProfile | null) ?? null
}

/** CV-Profil aus Text ODER Webseiten-URL extrahieren und speichern. */
export async function saveJobCv(input: { text?: string; url?: string }): Promise<CvProfile> {
  const supabase = await db()
  let raw = input.text?.trim() ?? ""
  if (!raw && input.url) {
    const res = await fetch(input.url, { headers: { "User-Agent": "Mozilla/5.0" } })
    if (!res.ok) throw new Error(`Webseite nicht abrufbar (${res.status})`)
    // grobes HTML-Strippen — Rest richtet die KI
    raw = (await res.text())
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 15000)
  }
  if (raw.length < 100) throw new Error("Zu wenig Lebenslauf-Text gefunden.")
  const profile = await extractCvProfile(raw)
  await supabase
    .from("settings")
    .upsert({ key: "job_cv_profile", value: profile as never, updated_at: new Date().toISOString() })
  revalidatePath("/jobs")
  return profile
}

/** Stellenanzeige aus rohem Text erfassen: extrahieren, gegen CV scoren, speichern. */
export async function addJob(rawText: string, sourceUrl?: string) {
  const supabase = await db()
  const job = await extractJob(rawText, sourceUrl)
  const cv = await loadCvProfile()
  const score = cv ? await scoreJob(cv, job) : null

  // Dedupe: normalisierte URL oder Firma+Titel-Fingerprint (Portal-übergreifend)
  const dupId = await findDuplicateJob(supabase, { company: job.company, title: job.title, url: sourceUrl })
  if (dupId) return { id: dupId, duplicate: true, job, score }

  const { data: created, error } = await supabase
    .from("job_applications")
    .insert({
      company: job.company,
      title: job.title,
      url: sourceUrl ?? null,
      city: job.city,
      salary: job.salary,
      description: `${job.summary}\n\n${rawText.slice(0, 3000)}`,
      requirements: job.requirements,
      contact_name: job.contact_name,
      contact_email: job.contact_email,
      match_score: score?.score ?? null,
      match_reasons: score ? ({ hits: score.hits, missing: score.missing, verdict: score.verdict } as never) : null,
    })
    .select("id")
    .single()
  if (error || !created) throw new Error(error?.message ?? "Anlegen fehlgeschlagen")
  revalidatePath("/jobs")
  return { id: created.id, duplicate: false, job, score }
}

export async function updateJobStage(id: string, stage: string) {
  const supabase = await db()
  const patch: TablesUpdate<"job_applications"> = { stage, updated_at: new Date().toISOString() }
  if (stage === "applied") patch.applied_at = new Date().toISOString()
  const { error } = await supabase.from("job_applications").update(patch).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/jobs")
}

export async function updateJobNotes(id: string, notes: string) {
  const supabase = await db()
  await supabase
    .from("job_applications")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", id)
  revalidatePath("/jobs")
}

export async function deleteJob(id: string) {
  const supabase = await db()
  await supabase.from("job_applications").delete().eq("id", id)
  revalidatePath("/jobs")
}

export async function generateJobCoverLetter(id: string, wishes?: string): Promise<string> {
  const supabase = await db()
  const cv = await loadCvProfile()
  if (!cv) throw new Error("Erst Lebenslauf hochladen (JobOS → CV).")
  const { data: job } = await supabase
    .from("job_applications")
    .select("company, title, description, requirements, city")
    .eq("id", id)
    .single()
  if (!job) throw new Error("Stelle nicht gefunden")
  const letter = await generateCoverLetter(
    cv,
    job,
    job.city === "berlin" || job.city === "wien" ? "de" : "de",
    wishes
  )
  await supabase
    .from("job_applications")
    .update({ cover_letter: letter, updated_at: new Date().toISOString() })
    .eq("id", id)
  revalidatePath("/jobs")
  return letter
}

/** Interview-Vorbereitung aus Inserat + CV generieren und an der Bewerbung speichern. */
export async function generateJobInterviewPrep(id: string): Promise<InterviewPrep> {
  const supabase = await db()
  const cv = await loadCvProfile()
  if (!cv) throw new Error("Erst Lebenslauf hochladen (JobOS → CV).")
  const { data: job } = await supabase
    .from("job_applications")
    .select("company, title, description, requirements, city, salary")
    .eq("id", id)
    .single()
  if (!job) throw new Error("Stelle nicht gefunden")
  const prep = await generateInterviewPrep(cv, {
    company: job.company,
    title: job.title,
    city: job.city as never,
    salary: job.salary,
    requirements: job.requirements,
    summary: "",
    contact_name: null,
    contact_email: null,
    description: job.description,
  })
  await supabase
    .from("job_applications")
    .update({ interview_prep: prep as never, updated_at: new Date().toISOString() })
    .eq("id", id)
  revalidatePath("/jobs")
  return prep
}

/** Mehrere Kontakte auf einmal löschen (Matchbox-Mehrfachauswahl). */
export async function bulkDeleteContacts(ids: string[]) {
  const supabase = await db()
  if (!ids.length) return
  const { error } = await supabase.from("contacts").delete().in("id", ids)
  if (error) throw new Error(error.message)
  revalidatePath("/contacts")
  revalidatePath("/")
  revalidatePath("/pipeline")
}
