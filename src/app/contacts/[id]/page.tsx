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

  const [contactRes, messagesRes, memoriesRes, summaryRes, channelsRes, datesRes, followupsRes, meetupsRes, invitesRes] =
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
    ])

  const contact = contactRes.data
  if (!contact) notFound()

  const matchScore = datingScore(
    (messagesRes.data ?? []).map((m) => ({ direction: m.direction, sent_at: m.sent_at }) as ScoreMessage),
    { pipeline_stage: contact.pipeline_stage, location: contact.location }
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
          <ReplyGenerator contactId={id} language={contact.language ?? "de"} />
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
          <DatePanel contactId={id} dates={datesRes.data ?? []} />
        </div>
      </div>
    </div>
  )
}
