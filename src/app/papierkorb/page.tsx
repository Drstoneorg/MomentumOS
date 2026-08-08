import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui"
import { TrashList } from "./TrashList"

export const dynamic = "force-dynamic"

/**
 * Papierkorb: gelöschte Kontakte als Schnappschuss, 30 Tage wiederherstellbar.
 * Danach räumt der tägliche Cron endgültig auf (inklusive Avatar-Datei).
 */
export default async function PapierkorbPage() {
  const supabase = await createClient()
  const { data: eintraege } = await supabase
    .from("trash")
    .select("id, kind, label, deleted_at")
    .order("deleted_at", { ascending: false })
    .limit(200)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">🗑 Papierkorb</h1>
        <p className="text-sm text-zinc-400">
          Gelöschte Kontakte landen hier und sind 30 Tage wiederherstellbar — samt Chats,
          Gedächtnis und Einladungen. Danach räumt der tägliche Lauf endgültig auf
        </p>
      </div>
      <Card>
        <TrashList eintraege={eintraege ?? []} />
      </Card>
    </div>
  )
}
