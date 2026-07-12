import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Tables } from "@/lib/database.types"
import { daysUntilBirthday, turningAge } from "@/lib/moments"
import { generateMomentMessages } from "@/lib/ai/momentMessage"
import { generateImagePrompt } from "@/lib/ai/imagePrompt"
import { generateImage, imageGenerationAvailable } from "@/lib/ai/generateImage"

export const maxDuration = 120

const LOOKAHEAD_DAYS = 7
const TIME_BUDGET_MS = 90_000 // vor dem Vercel-Limit sauber aufhören, Rest beim nächsten Klick

/**
 * Batch-Kartengenerierung: legt für ALLE Geburtstage der nächsten 7 Tage in einem
 * Rutsch Gruß-Entwürfe (Text + Bild wenn Key da) in die Queue. Sendet nichts —
 * morgens durchgehen, senden/verwerfen. Duplikate (schon vorbereiteter Gruß)
 * werden übersprungen. Bei vielen Geburtstagen: Zeitbudget, Rest beim nächsten Klick.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const started = Date.now()

  const [{ data: contacts }, { data: styleRow }] = await Promise.all([
    admin.from("contacts").select("*").neq("pipeline_stage", "archived").not("birthday", "is", null),
    admin.from("settings").select("value").eq("key", "user_style_profile").maybeSingle(),
  ])
  const styleProfile =
    typeof styleRow?.value === "string" && styleRow.value.trim()
      ? styleRow.value
      : "Natürlich, direkt, leicht humorvoll, charmant. Kurze echte Nachrichten."

  const upcoming = (contacts ?? [])
    .map((c) => ({ c, d: daysUntilBirthday(c.birthday) }))
    .filter(
      (x): x is { c: Tables<"contacts">; d: number } =>
        x.d != null && x.d >= 1 && x.d <= LOOKAHEAD_DAYS
    )
    .sort((a, b) => a.d - b.d)

  const results: { name: string; status: string }[] = []
  let stoppedEarly = false

  for (const { c, d } of upcoming) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      stoppedEarly = true
      break
    }
    // Schon vorbereitet? (offener 🎂-Entwurf der letzten 8 Tage)
    const { data: existing } = await admin
      .from("suggestions")
      .select("id")
      .eq("contact_id", c.id)
      .in("status", ["draft", "approved"])
      .like("situation", "🎂%")
      .gte("created_at", new Date(Date.now() - 8 * 86400_000).toISOString())
      .limit(1)
      .maybeSingle()
    if (existing) {
      results.push({ name: c.name, status: "übersprungen (schon vorbereitet)" })
      continue
    }

    try {
      const msg = await generateMomentMessages({
        kind: "birthday",
        name: c.name,
        relationship: (c.relationship_tags ?? []).join(", "),
        language: c.language ?? "de",
        styleProfile,
        context: [
          c.interests?.length ? `Interessen: ${c.interests.join(", ")}` : null,
          turningAge(c.birthday) ? `wird ${turningAge(c.birthday)}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })

      let imageUrl: string | null = null
      if (imageGenerationAvailable() && Date.now() - started < TIME_BUDGET_MS) {
        try {
          const p = await generateImagePrompt({
            occasion: "Geburtstag",
            name: c.name,
            style: "Anime",
            details: (c.interests ?? []).join(", "),
            format: "portrait",
          })
          const img = await generateImage(admin, p.prompt, { size: "1024x1536", pathPrefix: c.id })
          imageUrl = img.url
          await admin.from("moment_assets").insert({
            contact_id: c.id,
            kind: "image",
            title: "Geburtstagsbild (Batch)",
            content: img.url,
            meta: { prompt: p.prompt, caption: p.caption },
          })
        } catch {
          // Bild optional — Text-Gruß zählt
        }
      }

      await admin.from("suggestions").insert({
        contact_id: c.id,
        situation: `🎂 Geburtstag in ${d}d — vorbereitet (Batch), kopieren und senden`,
        variants: msg.variants,
        chosen_variant: Object.keys(msg.variants)[0] ?? null,
        channel: "manual",
        status: "draft",
        image_url: imageUrl,
      })
      results.push({ name: c.name, status: imageUrl ? "Text + Bild ✓" : "Text ✓" })
    } catch (e) {
      results.push({
        name: c.name,
        status: `Fehler: ${e instanceof Error ? e.message : "unbekannt"}`,
      })
    }
  }

  return NextResponse.json({
    upcoming: upcoming.length,
    created: results.filter((r) => r.status.includes("✓")).length,
    stoppedEarly,
    results,
  })
}
