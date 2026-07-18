"use client"

import { useState, useTransition } from "react"
import { saveSetting } from "@/lib/actions"
import { setupTelegramWebhook, disableTelegramWebhook } from "@/lib/signalActions"
import { btnCls, btnGhostCls, inputCls } from "@/components/ui"

/**
 * Telegram-Bot für Digest/Warnungen an MICH (nicht an Matches).
 * Einrichtung: @BotFather → /newbot → Token hier rein. Chat-ID: dem eigenen
 * Bot eine Nachricht schicken, dann https://api.telegram.org/bot<TOKEN>/getUpdates
 * öffnen — die ID steht unter message.chat.id.
 */
export function TelegramBotForm({
  currentToken,
  currentChatId,
  webhookActive = false,
}: {
  currentToken: string
  currentChatId: string
  webhookActive?: boolean
}) {
  const [token, setToken] = useState(currentToken)
  const [chatId, setChatId] = useState(currentChatId)
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)
  const [hookActive, setHookActive] = useState(webhookActive)
  const [hookError, setHookError] = useState<string | null>(null)

  function save() {
    start(async () => {
      await saveSetting("telegram_bot_token", token.trim())
      await saveSetting("telegram_chat_id", chatId.trim())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="space-y-2">
      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Bot-Token von @BotFather (123456:ABC-…)"
        className={inputCls}
        type="password"
        autoComplete="off"
      />
      <input
        value={chatId}
        onChange={(e) => setChatId(e.target.value)}
        placeholder="Chat-ID (deine eigene, siehe Anleitung unten)"
        className={inputCls}
        autoComplete="off"
      />
      <button onClick={save} disabled={pending} className={btnCls}>
        {pending ? "Speichere…" : saved ? "✓ Gespeichert" : "Speichern"}
      </button>
      <p className="text-xs text-zinc-500">
        Einrichtung (2 Min): in Telegram <b>@BotFather</b> öffnen → <code>/newbot</code> →
        Token hierher kopieren. Dann deinem neuen Bot irgendeine Nachricht schicken und{" "}
        <code>api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> im Browser öffnen — dort
        steht deine Chat-ID unter <code>message.chat.id</code>. Ohne Eintrag kommt der
        Digest als Web-Push.
      </p>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <p className="text-sm font-medium text-zinc-200">
          Inline-Buttons {hookActive ? "✅ aktiv" : "— aus"}
        </p>
        <p className="mb-2 text-xs text-zinc-500">
          Briefing-Nachrichten bekommen Knöpfe (✓ Erledigt, 💤 Snooze, Freigeben) — handeln
          direkt aus Telegram, ohne die App zu öffnen
        </p>
        <button
          onClick={() =>
            start(async () => {
              setHookError(null)
              const res = hookActive ? await disableTelegramWebhook() : await setupTelegramWebhook()
              if (res.error) setHookError(res.error)
              else setHookActive(!hookActive)
            })
          }
          disabled={pending}
          className={hookActive ? btnGhostCls : btnCls}
        >
          {hookActive ? "Deaktivieren" : "Aktivieren"}
        </button>
        {hookError && <p className="mt-1 text-xs text-rose-400">{hookError}</p>}
      </div>
    </div>
  )
}
