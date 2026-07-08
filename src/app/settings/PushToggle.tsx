"use client"

import { useEffect, useState } from "react"
import { btnCls, btnGhostCls } from "@/components/ui"

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function PushToggle({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = useState<"unsupported" | "off" | "on" | "denied" | "loading">("loading")

  useEffect(() => {
    ;(async () => {
      if (!vapidKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported")
        return
      }
      if (Notification.permission === "denied") {
        setState("denied")
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setState(sub ? "on" : "off")
    })()
  }, [vapidKey])

  async function enable() {
    setState("loading")
    try {
      const perm = await Notification.requestPermission()
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off")
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey!),
      })
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      })
      setState(res.ok ? "on" : "off")
    } catch {
      setState("off")
    }
  }

  async function disable() {
    setState("loading")
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      })
      await sub.unsubscribe()
    }
    setState("off")
  }

  if (state === "loading") return <p className="text-sm text-zinc-500">…</p>
  if (state === "unsupported")
    return (
      <p className="text-sm text-zinc-500">
        {vapidKey
          ? "Browser unterstützt kein Web Push (iOS: erst „Zum Home-Bildschirm“ hinzufügen)."
          : "VAPID-Keys fehlen — NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY setzen."}
      </p>
    )
  if (state === "denied")
    return <p className="text-sm text-amber-400">Benachrichtigungen im Browser blockiert — in den Seiteneinstellungen erlauben.</p>

  return state === "on" ? (
    <div className="flex items-center gap-3">
      <span className="text-sm text-emerald-400">✓ Push aktiv auf diesem Gerät</span>
      <button onClick={disable} className={btnGhostCls}>Deaktivieren</button>
    </div>
  ) : (
    <button onClick={enable} className={btnCls}>Push aktivieren</button>
  )
}
