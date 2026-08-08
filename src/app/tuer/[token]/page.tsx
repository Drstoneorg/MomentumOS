import type { Metadata } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { TuerPublicList } from "./TuerPublicList"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Einlass", robots: { index: false } }

/**
 * Türsteher-Ansicht ohne Login: der door_token des Events in der URL ist die
 * Berechtigung (wie beim Kalender-Feed). Zeigt NUR die Einlass-Liste dieses
 * einen Events — Namen, Begleitung, Check-in. Keine Navigation, keine
 * weiteren Daten. Ungültiger Token: neutrale Meldung.
 */
export default async function TuerTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  let event: { id: string; title: string; starts_at: string | null } | null = null
  let gaeste: {
    inviteId: string
    name: string
    status: string
    plus_ones: number
    companion_names: string | null
  }[] = []

  if (/^[a-f0-9]{32}$/.test(token)) {
    try {
      const admin = createAdminClient()
      const { data } = await admin
        .from("events")
        .select("id, title, starts_at")
        .eq("door_token", token)
        .maybeSingle()
      event = data
      if (event) {
        const { data: invites } = await admin
          .from("event_invites")
          .select("id, status, plus_ones, companion_names, contacts(name)")
          .eq("event_id", event.id)
          .in("status", ["yes", "ticket", "attended"])
        gaeste = (invites ?? [])
          .filter((i) => i.contacts)
          .map((i) => ({
            inviteId: i.id,
            name: i.contacts!.name,
            status: i.status,
            plus_ones: i.plus_ones ?? 0,
            companion_names: i.companion_names,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      }
    } catch {
      event = null
    }
  }

  if (!event) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <span className="text-4xl">🚪</span>
        <h1 className="mt-4 text-xl font-bold text-white">Liste nicht gefunden</h1>
        <p className="mt-2 text-sm text-zinc-400">Der Link ist nicht mehr gültig</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-3 px-4 py-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Einlass</p>
        <h1 className="mt-1 text-xl font-bold text-white">{event.title}</h1>
      </div>
      <TuerPublicList doorToken={token} gaeste={gaeste} />
      <p className="pt-4 text-center text-xs text-zinc-600">
        Tippen checkt ein, nochmal tippen macht es rückgängig
      </p>
    </div>
  )
}
