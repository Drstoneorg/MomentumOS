import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cardSafeFacts } from "@/lib/ai/cardFacts"
import { generateCardDetails } from "@/lib/ai/generateCard"
import { editImage, generateImage, imageGenerationAvailable, ImageSafetyError } from "@/lib/ai/generateImage"

export const maxDuration = 120

/**
 * Erzeugt eine personalisierte TCG-Karte für einen Kontakt.
 * Body: { contactId, factIds: string[], templateId?: string, wishes?: string, withImage?: boolean }
 *
 * Privacy: Der Server bildet die Whitelist-Fakten SELBST (cardSafeFacts) und
 * schneidet auf die gewählten factIds zu — der Client kann keine gesperrten
 * Daten einschleusen, nur aus der Whitelist abwählen.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = (await req.json()) as {
    contactId: string
    factIds?: string[]
    templateId?: string
    wishes?: string
    withImage?: boolean
  }
  if (!body.contactId) return NextResponse.json({ error: "contactId fehlt" }, { status: 400 })

  try {
    const [{ data: contact }, { data: memories }] = await Promise.all([
      supabase.from("contacts").select("*").eq("id", body.contactId).single(),
      supabase.from("memories").select("id, kind, content").eq("contact_id", body.contactId),
    ])
    if (!contact) return NextResponse.json({ error: "Kontakt nicht gefunden" }, { status: 404 })

    const allFacts = cardSafeFacts(contact, memories ?? [])
    const chosen = body.factIds?.length
      ? allFacts.filter((f) => body.factIds!.includes(f.id))
      : allFacts

    const details = await generateCardDetails(chosen, body.wishes)

    // Bild optional (Kosten) — Vorlage vorhanden: edits-API behält Rahmen/Layout.
    let imageUrl: string | null = null
    if (body.withImage !== false) {
      if (!imageGenerationAvailable()) {
        return NextResponse.json(
          { error: "Bild-Generierung nicht aktiv — OPENAI_API_KEY setzen.", details },
          { status: 400 }
        )
      }
      const admin = createAdminClient()
      if (body.templateId) {
        const { data: template } = await supabase
          .from("card_templates")
          .select("*")
          .eq("id", body.templateId)
          .single()
        if (!template) return NextResponse.json({ error: "Vorlage nicht gefunden" }, { status: 404 })
        const prompt = `This is a trading card template. Keep the card frame, layout, borders and overall design EXACTLY as in the reference image. Only replace: (1) the artwork in the picture area with: ${details.image_prompt}. (2) the card name text with "${details.title}". (3) the type line with "${details.type_line}". (4) the effect text box with "${details.effect}". (5) attack/defense values with ${details.attack}/${details.defense}. Style notes: ${template.style_notes ?? "match the template style"}. No real or identifiable people.`
        imageUrl = (await editImage(admin, prompt, template.image_url, {
          size: "1024x1536",
          quality: "medium",
          pathPrefix: `cards/${body.contactId}`,
        })).url
      } else {
        const prompt = `A complete trading card game card design, portrait orientation. Ornate card frame with title banner "${details.title}", type line "${details.type_line}", element ${details.element}, rarity ${details.rarity}. Artwork area: ${details.image_prompt}. Text box with effect text "${details.effect}". Attack ${details.attack}, defense ${details.defense} shown at the bottom. Fantasy anime TCG art style, vibrant, high detail. No real or identifiable people.`
        imageUrl = (await generateImage(admin, prompt, {
          size: "1024x1536",
          quality: "medium",
          pathPrefix: `cards/${body.contactId}`,
        })).url
      }
    }

    const { data: asset } = await supabase
      .from("moment_assets")
      .insert({
        contact_id: body.contactId,
        kind: "card",
        title: details.title,
        content: imageUrl ?? "",
        meta: {
          card: details,
          template_id: body.templateId ?? null,
          facts_used: chosen.map((f) => `${f.label}: ${f.value}`),
          // Für Re-Roll mit gleichen Einstellungen
          fact_ids: chosen.map((f) => f.id),
          wishes: body.wishes ?? null,
        },
      })
      .select("id")
      .single()

    return NextResponse.json({ details, imageUrl, assetId: asset?.id ?? null, factsUsed: chosen })
  } catch (e) {
    if (e instanceof ImageSafetyError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Karten-Fehler" },
      { status: 500 }
    )
  }
}
