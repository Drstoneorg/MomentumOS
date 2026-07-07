import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

/** Service-Role-Client — umgeht RLS. Nur serverseitig in Cron/Worker nutzen, nie im Browser. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt")
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  })
}
