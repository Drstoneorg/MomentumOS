import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui"
import { ProviderConsole } from "./ProviderConsole"

export const dynamic = "force-dynamic"

export default async function ProviderPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>
}) {
  const { as } = await searchParams
  const supabase = await createClient()

  const { data: providers } = await supabase
    .from("providers")
    .select("*")
    .order("name")

  if (!providers?.length) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-xl font-bold">Anbieter-Bereich</h1>
        <Card title="Keine Anbieter">
          <p className="text-sm text-zinc-500">Noch keine Anbieter angelegt.</p>
        </Card>
      </div>
    )
  }

  const activeId = as && providers.some((p) => p.id === as) ? as : providers[0].id

  // Offene Angebote (nicht abgelaufen) für diesen Anbieter
  const { data: offers } = await supabase
    .from("booking_offers")
    .select("id, distance_km, expires_at, bookings(id, address, price_cents, customer_note, duration_min, treatments(name))")
    .eq("provider_id", activeId)
    .eq("status", "offered")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

  // Laufende Jobs
  const { data: jobs } = await supabase
    .from("bookings")
    .select("*, treatments(name)")
    .eq("provider_id", activeId)
    .in("status", ["accepted", "en_route", "arrived", "in_progress"])
    .order("accepted_at", { ascending: false })

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold">Anbieter-Bereich</h1>
      <ProviderConsole
        providers={providers}
        activeId={activeId}
        offers={offers ?? []}
        jobs={jobs ?? []}
      />
    </div>
  )
}
