"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { addChannel } from "@/lib/actions"
import type { Tables } from "@/lib/database.types"
import { Card, inputCls, btnCls } from "@/components/ui"

const CHANNELS = ["telegram", "whatsapp", "instagram", "tiktok", "snapchat", "wechat", "line"]

export function ChannelPanel({
  contactId,
  channels,
}: {
  contactId: string
  channels: Tables<"contact_channels">[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [channel, setChannel] = useState("telegram")
  const [handle, setHandle] = useState("")

  return (
    <Card title="Kontaktwege">
      <ul className="mb-3 space-y-1 text-sm">
        {channels.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-zinc-300">
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">{c.channel}</span>
            {c.handle}
            {c.is_primary && <span className="text-xs text-rose-400">primär</span>}
          </li>
        ))}
        {!channels.length && (
          <li className="text-zinc-500">Nur Dating-App. Bei Plattformwechsel Handle eintragen.</li>
        )}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!handle.trim()) return
          start(async () => {
            await addChannel({
              contact_id: contactId,
              channel,
              handle: handle.trim(),
              is_primary: channels.length === 0,
            })
            setHandle("")
            router.refresh()
          })
        }}
        className="flex gap-2"
      >
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls + " w-auto"}>
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle / Nummer" className={inputCls} />
        <button type="submit" disabled={pending} className={btnCls}>+</button>
      </form>
      <p className="mt-2 text-xs text-zinc-600">
        Telegram-Handle nötig, damit der Worker Nachrichten zuordnen und senden kann.
      </p>
    </Card>
  )
}
