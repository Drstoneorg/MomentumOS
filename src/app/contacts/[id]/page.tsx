import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, StageBadge } from "@/components/ui"
import { ChatPanel } from "./ChatPanel"
import { ReplyGenerator } from "./ReplyGenerator"
import { MemoryPanel } from "./MemoryPanel"
import { ContactHeader } from "./ContactHeader"
import { DatePanel } from "./DatePanel"
import { ChannelPanel } from "./ChannelPanel"

export const dynamic = "force-dynamic"

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [contactRes, messagesRes, memoriesRes, summaryRes, channelsRes, datesRes] =
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
    ])

  const contact = contactRes.data
  if (!contact) notFound()

  return (
    <div className="space-y-4">
      <ContactHeader contact={contact} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ChatPanel contactId={id} messages={messagesRes.data ?? []} />
          <ReplyGenerator contactId={id} language={contact.language ?? "de"} />
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

          <MemoryPanel contactId={id} memories={memoriesRes.data ?? []} />
          <ChannelPanel contactId={id} channels={channelsRes.data ?? []} />
          <DatePanel contactId={id} dates={datesRes.data ?? []} />
        </div>
      </div>
    </div>
  )
}
