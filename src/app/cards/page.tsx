import { createClient } from "@/lib/supabase/server"
import { CardBuilder } from "./CardBuilder"
import { TemplateManager } from "./TemplateManager"
import { CardGallery } from "./CardGallery"

export const dynamic = "force-dynamic"

export default async function CardsPage() {
  const supabase = await createClient()
  const [{ data: contacts }, { data: templates }, { data: cards }] = await Promise.all([
    supabase.from("contacts").select("id, name").order("name"),
    supabase.from("card_templates").select("*").order("created_at", { ascending: false }),
    supabase
      .from("moment_assets")
      .select("*")
      .eq("kind", "card")
      .order("created_at", { ascending: false }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">TCG-Karten</h1>
        <p className="text-sm text-zinc-400">
          Personalisierte Sammelkarten aus deinen Kontakten. Es werden nur allgemeine Infos
          verwendet (Vorname, Interessen, Hobbies) — nie private Details wie Wohnort, Alter,
          Beruf oder Chatinhalte.
        </p>
      </div>

      <CardBuilder
        contacts={contacts ?? []}
        templates={(templates ?? []).map((t) => ({ id: t.id, name: t.name }))}
      />

      <TemplateManager templates={templates ?? []} />

      <CardGallery cards={cards ?? []} contacts={contacts ?? []} />
    </div>
  )
}
