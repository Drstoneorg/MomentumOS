"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { queueMeetupTelegram } from "@/lib/momentsActions"
import { channelDeepLink } from "@/lib/channels"
import type { Json } from "@/lib/database.types"
import { Card, inputCls, btnCls, btnGhostCls } from "@/components/ui"

type Slot = { when: string; place: string }
type Participant = {
  id: string
  contact_id: string
  contacts: {
    name: string
    language: string | null
    contact_channels: { channel: string; handle: string; is_primary: boolean }[]
  } | null
}

export function MeetupAnnounce({
  meetupId,
  title,
  slots,
  chosenSlot,
  participants,
}: {
  meetupId: string
  title: string
  slots: Json
  chosenSlot: number | null
  participants: Participant[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [tgDone, setTgDone] = useState<number | null>(null)

  const slot = chosenSlot != null ? ((slots as unknown as Slot[])?.[chosenSlot] ?? null) : null

  const whenStr = slot
    ? new Date(slot.when).toLocaleString("de-DE", { dateStyle: "full", timeStyle: "short" })
    : null

  async function generate() {
    setLoading(true)
    const firstContact = participants[0]?.contact_id
    const context = `Meetup „${title}". Ort: ${slot?.place || "wird noch gesagt"}. Zeit: ${whenStr || "wird noch abgestimmt"}. Es ist eine Einladung — die Person ist eingeladen und soll Ort/Zeit erfahren.`
    const res = await fetch("/api/moments/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: firstContact, kind: "meetup", context }),
    })
    setLoading(false)
    const data = await res.json()
    if (!res.ok) return alert(data.error ?? "Fehler")
    setText((Object.values(data.variants)[0] as string) ?? "")
  }

  function fallbackText() {
    setText(
      `Hey! Ich organisiere „${title}"${whenStr ? ` am ${whenStr}` : ""}${slot?.place ? ` bei ${slot.place}` : ""}. Du bist eingeladen — sag Bescheid ob du dabei bist!`
    )
  }

  async function copy(key: string, t: string) {
    await navigator.clipboard.writeText(t)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const telegramParticipants = participants.filter((p) =>
    p.contacts?.contact_channels?.some((c) => c.channel === "telegram")
  )

  return (
    <Card title="Einladen & Benachrichtigen">
      <div className="space-y-2">
        <div className="rounded-lg bg-zinc-950 p-2 text-sm text-zinc-400">
          {slot ? (
            <>📍 {slot.place || "Ort offen"} · 🕒 {whenStr}</>
          ) : (
            <>Noch kein Termin gewählt — trotzdem einladen geht, Ort/Zeit dann „wird abgestimmt&quot;.</>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={generate} disabled={loading} className={btnCls}>
            {loading ? "…" : "Einladungstext generieren"}
          </button>
          <button onClick={fallbackText} className={btnGhostCls}>Standardtext</button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Einladungstext — generieren oder selbst schreiben. Wird pro Person über den Kanal verschickt."
          className={inputCls}
        />

        {text.trim() && (
          <>
            {telegramParticipants.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-800 p-2">
                <span className="text-sm text-zinc-300">
                  {telegramParticipants.length} Telegram-Teilnehmer
                </span>
                <button
                  onClick={() =>
                    start(async () => {
                      const n = await queueMeetupTelegram(
                        meetupId,
                        telegramParticipants.map((p) => p.contact_id),
                        text
                      )
                      setTgDone(n)
                      router.refresh()
                    })
                  }
                  disabled={pending}
                  className={btnCls + " ml-auto"}
                >
                  In Queue → Worker sendet
                </button>
              </div>
            )}
            {tgDone != null && (
              <p className="text-xs text-emerald-400">
                {tgDone} Telegram-Einladung(en) in der Queue — dort freigeben.
              </p>
            )}

            <div className="space-y-2">
              {participants.map((p) => {
                const channels = p.contacts?.contact_channels ?? []
                return (
                  <div key={p.id} className="rounded-lg border border-zinc-800 p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{p.contacts?.name}</span>
                      <button onClick={() => copy(p.id, text)} className={btnGhostCls + " ml-auto"}>
                        {copied === p.id ? "✓ kopiert" : "Text kopieren"}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {channels.length === 0 && (
                        <span className="text-xs text-zinc-600">Kein Kanal hinterlegt — auf Kontaktseite ergänzen.</span>
                      )}
                      {channels.map((c) => {
                        const link = channelDeepLink(c.channel, c.handle, text)
                        if (!link.url) {
                          return (
                            <span key={c.channel} className="rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-600" title={link.hint}>
                              {link.label}: kopieren
                            </span>
                          )
                        }
                        return (
                          <a
                            key={c.channel}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            title={link.hint}
                            onClick={() => copy(p.id, text)}
                            className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                          >
                            {link.label} ↗
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
