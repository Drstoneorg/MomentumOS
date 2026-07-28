"use server"

import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "@/lib/database.types"

/**
 * Anmeldung läuft serverseitig, damit die Auth-Cookies per Set-Cookie-Header
 * ankommen. Grund: Safari kappt Cookies, die per document.cookie geschrieben
 * werden, auf 7 Tage — und genau so schreibt sie der Browser-Client. Auf iPhone
 * und in der installierten PWA flog man deshalb regelmäßig raus. Vom Server
 * gesetzte Cookies trifft diese Kappung nicht.
 */

// 400 Tage — die Obergrenze, die Chrome und Safari für Cookies akzeptieren.
const REMEMBER_MAX_AGE = 400 * 24 * 60 * 60

export async function signIn(input: {
  email: string
  password: string
  remember: boolean
}) {
  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              // Ohne Haken fehlen maxAge und expires komplett — daraus wird ein
              // Session-Cookie, das beim Schließen des Browsers verfällt.
              maxAge: input.remember ? REMEMBER_MAX_AGE : undefined,
              expires: undefined,
            })
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })
  if (error) return { error: error.message }
  return {}
}
