import { NextResponse } from "next/server"
import { createEvent } from "ics"
import { createClient } from "@/lib/supabase/server"

type Slot = { when: string; place: string }

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const [meetupRes, partsRes] = await Promise.all([
    supabase.from("meetups").select("*").eq("id", id).single(),
    supabase.from("meetup_participants").select("contacts(name)").eq("meetup_id", id),
  ])
  const meetup = meetupRes.data
  if (!meetup || meetup.chosen_slot == null) {
    return NextResponse.json({ error: "kein Termin gewählt" }, { status: 400 })
  }
  const slots = (meetup.slots as unknown as Slot[]) ?? []
  const slot = slots[meetup.chosen_slot]
  if (!slot) return NextResponse.json({ error: "Slot fehlt" }, { status: 400 })

  const names = (partsRes.data ?? []).map((p) => p.contacts?.name).filter(Boolean).join(", ")
  const start = new Date(slot.when)

  const { error, value } = createEvent({
    title: meetup.title,
    description: [meetup.notes, names ? `Mit: ${names}` : null].filter(Boolean).join("\n"),
    location: slot.place || undefined,
    start: [start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()],
    duration: { hours: 2 },
    alarms: [
      { action: "display", description: `Morgen: ${meetup.title}`, trigger: { hours: 24, before: true } },
      { action: "display", description: `Bald: ${meetup.title}`, trigger: { hours: 2, before: true } },
    ],
  })
  if (error || !value) return NextResponse.json({ error: String(error) }, { status: 500 })

  return new NextResponse(value, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="meetup-${meetup.title}.ics"`,
    },
  })
}
