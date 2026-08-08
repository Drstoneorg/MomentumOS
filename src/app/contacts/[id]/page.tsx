import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, StageBadge } from "@/components/ui"
import { ChatPanel } from "./ChatPanel"
import { ReplyGenerator } from "./ReplyGenerator"
import { MemoryPanel } from "./MemoryPanel"
import { ContactHeader } from "./ContactHeader"
import { DatePanel } from "./DatePanel"
import { ChannelPanel } from "./ChannelPanel"
import { FriendsPanel } from "./FriendsPanel"
import { MomentGenerator } from "./MomentGenerator"
import { Timeline, type TimelineItem } from "./Timeline"
import { MatchScoreCard } from "./MatchScoreCard"
import { ReminderPanel } from "./ReminderPanel"
import { PhotoAnalyzeCard } from "./PhotoAnalyzeCard"
import { datingScore, type ScoreMessage } from "@/lib/scoring"
import { visionAvailable } from "@/lib/ai/vision"

export const dynamic = "force-dynamic"

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [contactRes, messagesRes, memoriesRes, summaryRes, channelsRes, datesRes, followupsRes, meetupsRes, invitesRes, nextEventRes, remindersRes] =
    await Promise.all([
      supabase.from("contacts").select("*").eq("id", id).single(),
      supabase.from("messages").select("*").eq("contact_id", id).order("sent_at"),
      supabase.from("memories").select("*").eq("contact_id", id).order("created_at"),
      supabase
        .from("conversation_summaries")
        .select("*")
        .eq("contact_id", id)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("contact_channels").select("*").eq("contact_id", id),
      supabase.from("dates").select("*").eq("contact_id", id).order("starts_at"),
      supabase.from("followups").select("*").eq("contact_id", id),
      supabase.from("meetup_participants").select("rsvp, meetups(title, status, created_at)").eq("contact_id", id),
      supabase.from("event_invites").select("status, created_at, events(title, starts_at)").eq("contact_id", id),
      supabase
        .from("events")
        .select("title, starts_at, location")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(1)
        .maybeSingle(),

      supabase
        .from("reminders")
        .select("id, due_at, note")
        .eq("contact_id", id)
        .is("done_at", null)
        .order("due_at"),
    ])

  const contact = contactRes.data
  if (!contact) notFound()

  const matchScore = datingScore(
    (messagesRes.data ?? []).map((m) => ({ direction: m.direction, sent_at: m.sent_at }) as ScoreMessage),
    {
      pipeline_stage: contact.pipeline_stage,
      location: contact.location,
      interests: contact.interests,
      bio: contact.bio,
      notes: contact.notes,
      photo_notes: contact.photo_notes,
      relationship_tags: contact.relationship_tags,
    }
  )

  const timeline: TimelineItem[] = [
    ...(messagesRes.data ?? []).map((m) => ({
      at: m.sent_at,
      kind: (m.direction === "in" ? "message_in" : "message_out") as TimelineItem["kind"],
      title: m.content.length > 90 ? m.content.slice(0, 90) + "…" : m.content,
      detail: m.channel,
    })),
    ...(memoriesRes.data ?? []).map((m) => ({
      at: m.created_at,
      kind: "memory" as const,
      title: m.content,
      detail: m.kind,
    })),
    ...(followupsRes.data ?? []).map((f) => ({
      at: f.due_at,
      kind: "followup" as const,
      title: f.reason ?? "Follow-up",
      detail: f.done ? "erledigt" : "offen",
    })),
    ...(datesRes.data ?? []).map((d) => ({
      at: d.starts_at,
      kind: "date" as const,
      title: d.idea ?? "Date",
      detail: d.place,
    })),
    ...(meetupsRes.data ?? []).map((p) => ({
      at: p.meetups?.created_at ?? new Date().toISOString(),
      kind: "meetup" as const,
      title: p.meetups?.title ?? "Meetup",
      detail: `RSVP: ${p.rsvp} · ${p.meetups?.status ?? ""}`,
    })),
    ...(invitesRes.data ?? []).map((i) => ({
      at: i.events?.starts_at ?? i.created_at,
      kind: "event" as const,
      title: i.events?.title ?? "Event",
      detail: `Einladung: ${i.status}`,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1))

  return (
    <div className="space-y-4">
      <ContactHeader contact={contact} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ChatPanel contactId={id} messages={messagesRes.data ?? []} />
          <ReplyGenerator
            contactId={id}
            language={contact.language ?? "de"}
            nextEvent={nextEventRes.data ?? null}
            memories={(memoriesRes.data ?? []).map((m) => ({
              id: m.id,
              kind: m.kind,
              content: m.content,
              created_at: m.created_at,
            }))}
          />
          <MomentGenerator contactId={id} />
          <Timeline items={timeline} />
        </div>

        <div className="space-y-4">
          <Card title="Status">
            <div className="space-y-2 text-sm">
              <StageBadge stage={contact.pipeline_stage} />
              <p className="text-zinc-300">
                <span className="text-zinc-500">Nächster Schritt:</span>{" "}
                {contact.next_step ?? "—"}
              </p>
              <p className="text-zinc-300">
                <span className="text-zinc-500">Date-Idee:</span>{" "}
                {contact.date_idea ?? "—"}
              </p>
            </div>
          </Card>

          <Card title="Zusammenfassung">
            <p className="whitespace-pre-wrap text-sm text-zinc-300">
              {summaryRes.data?.summary ?? "Noch keine — über „KI-Analyse“ erzeugen."}
            </p>
          </Card>

          <MatchScoreCard score={matchScore} />
          <PhotoAnalyzeCard available={visionAvailable()} />
          <FriendsPanel contact={contact} />
          <MemoryPanel contactId={id} memories={memoriesRes.data ?? []} />
          <ChannelPanel contactId={id} channels={channelsRes.data ?? []} />
          <ReminderPanel contactId={id} reminders={remindersRes.data ?? []} />
          <DatePanel contactId={id} dates={datesRes.data ?? []} />

          {(invitesRes.data ?? []).length > 0 && (
            <Card title="🎟 Event-Historie">
              <ul className="space-y-1 text-sm">
                {(invitesRes.data ?? [])
                  .slice()
                  .sort((a, b) => ((a.events?.starts_at ?? a.created_at) < (b.events?.starts_at ?? b.created_at) ? 1 : -1))
                  .slice(0, 8)
                  .map((i, n) => (
                    <li key={n} className="flex items-center justify-between gap-2">
                      <span className="truncate text-zinc-300">{i.events?.title ?? "Event"}</span>
                      <span
                        className={`shrink-0 text-xs ${
                          i.status === "attended"
                            ? "text-emerald-400"
                            : ["yes", "ticket"].includes(i.status)
                              ? "text-emerald-300/80"
                              : i.status === "no"
                                ? "text-zinc-500"
                                : "text-amber-400/80"
                        }`}
                      >
                        {i.status === "attended" ? "✔ da" : i.status === "ticket" ? "🎟" : i.status === "yes" ? "zugesagt" : i.status === "no" ? "abgesagt" : "offen"}
                      </span>
                    </li>
                  ))}
              </ul>
              {(() => {
                const alle = invitesRes.data ?? []
                const reagiert = alle.filter((i) => ["yes", "no", "ticket", "attended"].includes(i.status)).length
                return (
                  <p className="mt-2 text-xs text-zinc-600">
                    {alle.length} Einladungen · {reagiert} reagiert
                    {alle.length >= 2 && reagiert === 0 && " — im Assistenten abgestuft"}
                  </p>
                )
              })()}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
