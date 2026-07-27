import { NextResponse } from "next/server"
import { createEvent } from "ics"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: date } = await supabase
    .from("dates")
    .select("*, contacts(name, platform, date_idea, notes)")
    .eq("id", id)
    .single()
  if (!date) return NextResponse.json({ error: "not found" }, { status: 404 })

  const [summaryRes, memoriesRes] = await Promise.all([
    supabase
      .from("conversation_summaries")
      .select("summary")
      .eq("contact_id", date.contact_id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("memories")
      .select("kind, content")
      .eq("contact_id", date.contact_id)
      .limit(10),
  ])

  const start = new Date(date.starts_at)
  const description = [
    `Date mit ${date.contacts?.name} (${date.contacts?.platform})`,
    date.idea ? `Idee: ${date.idea}` : null,
    summaryRes.data?.summary ? `\nGespräch: ${summaryRes.data.summary}` : null,
    memoriesRes.data?.length
      ? `\nWichtig:\n${memoriesRes.data.map((m) => `- ${m.content}`).join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n")

  const { error, value } = createEvent({
    title: `Date mit ${date.contacts?.name}`,
    description,
    location: date.place ?? undefined,
    start: [
      start.getFullYear(),
      start.getMonth() + 1,
      start.getDate(),
      start.getHours(),
      start.getMinutes(),
    ],
    duration: { hours: 2 },
    alarms: [
      {
        action: "display",
        description: `Gleich Date mit ${date.contacts?.name}`,
        trigger: { hours: 2, before: true },
      },
    ],
  })
  if (error || !value) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }

  await supabase.from("dates").update({ ics_generated: true }).eq("id", id)

  return new NextResponse(value, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="date-${date.contacts?.name ?? "momentumos"}.ics"`,
    },
  })
}
