import { createClient } from "@/lib/supabase/server"
import { collectSignals } from "@/lib/signals"
import { FocusClient } from "./FocusClient"

export const dynamic = "force-dynamic"

/**
 * Tages-Fokus-Modus: alle Signale als geführter Stapel, eine Karte nach der
 * anderen — handeln, snoozen oder weiter. Null Navigation, Inbox leer.
 */
export default async function FocusPage() {
  const supabase = await createClient()
  const signals = await collectSignals(supabase)
  return <FocusClient signals={signals} />
}
