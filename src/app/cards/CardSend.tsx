"use client"

import { useState, useTransition } from "react"
import { channelDeepLink } from "@/lib/channels"
import { queueCardTelegram, logCardSend } from "@/lib/cardActions"
import { btnCls, btnGhostCls } from "@/components/ui"

type Channel = { channel: string; handle: string; is_primary?: boolean }

export function CardSend({
  contactId,
  assetId,
  imageUrl,
  channels,
  defaultText,
}: {
  contactId: string
  assetId: string | null
  imageUrl: string | null
  channels: Channel[]
  defaultText: string
}) {
  const [text, setText] = useState(defaultText)
  const [pending, start] = useTransition()
  const [sentVia, setSentVia] = useState<string[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [tgDone, setTgDone] = useState(false)

  function flash(m: string) {
    setMsg(m)
    setTimeout(() => setMsg(null), 2500)
  }

  async function copy(t: string, label: string) {
    await navigator.clipboard.writeText(t)
    flash(`${label} kopiert`)
  }

  // Versand notieren (Kanal-Historie in der Galerie).
  function markSent(channel: string) {
    if (!assetId || sentVia.includes(channel)) return
    setSentVia((v) => [...v, channel])
    start(async () => {
      try {
        await logCardSend({ assetId, contactId, channel })
      } catch {
        setSentVia((v) => v.filter((c) => c !== channel))
      }
    })
  }

  // Native Share-Sheet: teilt das echte Kartenbild als Datei (Handy/PWA → WhatsApp,
  // Telegram, Signal, Mail …), sonst URL, sonst kopiert die URL.
  async function shareImage() {
    if (!imageUrl) return flash("Kein Bild zum Teilen")
    try {
      const blob = await (await fetch(imageUrl)).blob()
      const file = new File([blob], "momentumos-karte.png", { type: blob.type || "image/png" })
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text })
        markSent("teilen")
        return
      }
      if (navigator.share) {
        await navigator.share({ url: imageUrl, text })
        markSent("teilen")
        return
      }
      await navigator.clipboard.writeText(imageUrl)
      flash("Teilen nicht unterstützt — Bild-URL kopiert")
    } catch {
      // Abbruch durch Nutzer — ignorieren
    }
  }

  const hasTelegram = channels.some((c) => c.channel === "telegram")

  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <p className="text-sm font-semibold text-white">Karte versenden</p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Begleittext (optional) — wird mit der Karte verschickt"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200"
      />

      <div className="flex flex-wrap gap-2">
        <button onClick={shareImage} className={btnCls}>
          📤 Teilen (Bild)
        </button>
        {imageUrl && (
          <button onClick={() => copy(imageUrl, "Bild-URL")} className={btnGhostCls}>
            Bild-URL kopieren
          </button>
        )}
        {text.trim() && (
          <button onClick={() => copy(text, "Text")} className={btnGhostCls}>
            Text kopieren
          </button>
        )}
      </div>

      {/* Telegram: Bild + Text über die Queue, Worker sendet nach Freigabe */}
      {hasTelegram && (
        <div className="flex items-center gap-2 rounded-lg border border-sky-900 bg-sky-950/30 p-2">
          <span className="text-sm text-sky-200">Telegram: Karte als Foto senden</span>
          <button
            onClick={() =>
              start(async () => {
                await queueCardTelegram({ contactId, text, imageUrl })
                setTgDone(true)
                markSent("telegram")
              })
            }
            disabled={pending}
            className={btnCls + " ml-auto"}
          >
            In Queue → Worker sendet
          </button>
        </div>
      )}
      {tgDone && (
        <p className="text-xs text-emerald-400">In der Queue — dort freigeben, dann sendet der Worker.</p>
      )}

      {/* Direkte Kanal-Links (WhatsApp mit Prefill, Instagram/TikTok öffnen Chat) */}
      {channels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">Kanal öffnen:</span>
          {channels.map((c) => {
            const link = channelDeepLink(c.channel, c.handle, text)
            if (!link.url) {
              return (
                <span
                  key={c.channel + c.handle}
                  className="rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-600"
                  title={link.hint}
                >
                  {link.label}: Text/Bild kopieren
                </span>
              )
            }
            return (
              <a
                key={c.channel + c.handle}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                title={link.hint}
                onClick={() => {
                  navigator.clipboard.writeText(text)
                  markSent(c.channel)
                }}
                className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                {link.label} ↗
              </a>
            )
          })}
        </div>
      )}

      {channels.length === 0 && !hasTelegram && (
        <p className="text-xs text-zinc-600">
          Kein Kanal hinterlegt — auf der Kontaktseite ergänzen, dann direkt versendbar. Teilen geht trotzdem.
        </p>
      )}

      {sentVia.length > 0 && (
        <p className="text-xs text-emerald-400">Notiert: {sentVia.join(", ")}</p>
      )}
      {msg && <p className="text-xs text-zinc-400">{msg}</p>}

      <p className="text-[10px] text-zinc-600">
        Hinweis: WhatsApp/Instagram-Links können kein Bild automatisch anhängen (Plattform-Grenze).
        Text wird vorbefüllt/kopiert, Bild über „Teilen&quot; oder eingefügt. Telegram sendet Bild + Text komplett.
      </p>
    </div>
  )
}
