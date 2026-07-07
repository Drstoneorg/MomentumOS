import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateMomentMessages, type MomentKind } from "@/lib/ai/momentMessage"

export const maxDuration = 60

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { contactId, kind, context } = (await req.json()) as {
    contactId?: string
    kind: MomentKind
    context?: string
  }

  const [{ data: style }, contactRes] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "user_style_profile").maybeSingle(),
    contactId
      ? supabase.from("contacts").select("*").eq("id", contactId).single()
      : Promise.resolve({ data: null }),
  ])
  const contact = contactRes.data
  const styleProfile =
    typeof style?.value === "string" && style.value.trim()
      ? style.value
      : "Natürlich, direkt, leicht humorvoll, charmant. Kurze echte Nachrichten."

  const ctxParts = [
    context,
    contact?.interests?.length ? `Interessen: ${contact.interests.join(", ")}` : null,
    contact?.notes ? `Notizen: ${contact.notes}` : null,
  ].filter(Boolean)

  try {
    const result = await generateMomentMessages({
      kind,
      name: contact?.name ?? "die Person",
      relationship: (contact?.relationship_tags ?? []).join(", "),
      language: contact?.language ?? "de",
      styleProfile,
      context: ctxParts.join(" · "),
    })

    if (contactId) {
      await supabase.from("moment_assets").insert({
        contact_id: contactId,
        kind: "text",
        title: `${kind}-Nachricht`,
        content: Object.values(result.variants)[0] ?? "",
        meta: { variants: result.variants, momentKind: kind },
      })
    }
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI-Fehler" },
      { status: 500 }
    )
  }
}
