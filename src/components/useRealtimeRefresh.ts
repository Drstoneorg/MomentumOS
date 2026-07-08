"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

// Lauscht auf Postgres-Änderungen einer Tabelle und refresht die Seite live.
// Wichtig: Realtime braucht das User-Token, sonst filtert RLS alle Events weg.
export function useRealtimeRefresh(table: string) {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    let cleanup: (() => void) | undefined

    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) await supabase.realtime.setAuth(session.access_token)

      const channel = supabase
        .channel(`realtime-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          router.refresh()
        })
        .subscribe()

      cleanup = () => {
        supabase.removeChannel(channel)
      }
    })()

    return () => cleanup?.()
  }, [table, router])
}
