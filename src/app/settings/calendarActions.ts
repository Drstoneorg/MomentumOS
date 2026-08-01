"use server"

import { randomBytes } from "crypto"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

/**
 * Token für den Kalender-Feed erzeugen bzw. erneuern. Kalender-Apps können
 * keine Cookies — der Feed authentifiziert deshalb über ein langes Zufalls-
 * Token in der URL. Erneuern macht alte Feed-URLs sofort ungültig.
 */
export async function regenerateCalendarToken(): Promise<{ token?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nicht angemeldet" }

  const token = randomBytes(24).toString("hex")
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "calendar_token", value: token }, { onConflict: "key" })
  if (error) return { error: error.message }
  revalidatePath("/settings")
  return { token }
}
