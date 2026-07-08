import webpush from "web-push"
import { createAdminClient } from "@/lib/supabase/admin"

export function pushAvailable() {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

// Sendet Push an alle registrierten Geräte; räumt tote Subscriptions weg.
export async function sendPushToAll(payload: { title: string; body: string; url?: string }) {
  if (!pushAvailable()) return { sent: 0 }
  webpush.setVapidDetails(
    "mailto:effystone00@icloud.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  const admin = createAdminClient()
  const { data: subs } = await admin.from("push_subscriptions").select("*")
  let sent = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      )
      sent++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", s.id)
      }
    }
  }
  return { sent }
}
