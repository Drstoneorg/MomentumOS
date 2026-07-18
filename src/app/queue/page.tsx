import { createClient } from "@/lib/supabase/server"
import { QueueBatch } from "./QueueBatch"
import { QueueLive } from "./QueueLive"

export const dynamic = "force-dynamic"

export default async function QueuePage() {
  const supabase = await createClient()
  const { data: suggestions } = await supabase
    .from("suggestions")
    .select("*, contacts(name, contact_channels(channel, handle))")
    .in("status", ["draft", "approved"])
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-4">
      <QueueLive />
      <h1 className="text-xl font-bold">Freigabe-Queue</h1>
      <p className="text-sm text-zinc-400">
        Entwürfe für Telegram. Variante wählen, freigeben — der Worker sendet. Ohne Freigabe geht nichts raus.
      </p>
      <QueueBatch
        items={(suggestions ?? []).map((s) => ({
          suggestion: s,
          contactName: s.contacts?.name ?? "?",
          channels: s.contacts?.contact_channels ?? [],
        }))}
      />
    </div>
  )
}
