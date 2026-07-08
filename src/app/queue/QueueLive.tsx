"use client"

import { useRealtimeRefresh } from "@/components/useRealtimeRefresh"

export function QueueLive() {
  useRealtimeRefresh("suggestions")
  return null
}
