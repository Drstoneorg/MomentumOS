import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Extension-Auth: Bearer-Token wird gegen settings.extension_token geprüft.
 * Gibt bei Erfolg den Admin-Client zurück (Extension hat keine Browser-Session).
 */
export async function authExtension(req: Request) {
  const auth = req.headers.get("authorization")
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "extension_token")
    .maybeSingle()

  const stored = typeof data?.value === "string" ? data.value : null
  if (!stored || stored.length < 20 || stored !== token) return null
  return supabase
}
