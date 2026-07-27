"use client"

import { useState, useTransition } from "react"
import { saveSetting } from "@/lib/actions"
import { btnCls, btnGhostCls } from "@/components/ui"
import { SITE_URL } from "@/lib/siteUrl"

/**
 * Ticketshop-Webhook aktivieren: Secret generieren, URL in Pretix/Eventbrite
 * als Webhook eintragen. Käufe mit Promo-Code setzen die Einladung dann
 * automatisch auf 🎟 Ticket.
 */
export function TicketWebhookForm({
  currentSecret,
  lastInfo,
}: {
  currentSecret: string
  lastInfo: { at: string; codesFound: number; matched: number } | null
}) {
  const [secret, setSecret] = useState(currentSecret)
  const [pending, start] = useTransition()
  const [copied, setCopied] = useState(false)

  const webhookUrl = secret
    ? `${SITE_URL}/api/tickets/webhook?key=${secret}`
    : null

  function generate() {
    const bytes = crypto.getRandomValues(new Uint8Array(24))
    const s = "tkt_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
    start(async () => {
      await saveSetting("ticket_webhook_secret", s)
      setSecret(s)
    })
  }

  return (
    <div className="space-y-2">
      {webhookUrl ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
            {webhookUrl}
          </code>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(webhookUrl)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            className={btnGhostCls}
          >
            {copied ? "✓" : "Kopieren"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Noch kein Secret — Webhook ist deaktiviert.</p>
      )}
      <button onClick={generate} disabled={pending} className={btnCls}>
        {secret ? "Neu generieren (alte URL wird ungültig)" : "Webhook aktivieren"}
      </button>
      <p className="text-xs text-zinc-500">
        Diese URL im Ticketshop als Webhook für „Bestellung bezahlt&quot; eintragen
        (Pretix: Einstellungen → Webhooks). Enthält die Bestellung einen Promo-Code
        eines Gastes, springt dessen Einladung automatisch auf 🎟 Ticket.
      </p>
      {lastInfo && (
        <p className="text-xs text-zinc-600">
          Letzter Webhook: {new Date(lastInfo.at).toLocaleString("de-DE")} —{" "}
          {lastInfo.codesFound} Codes gefunden, {lastInfo.matched} Einladungen aktualisiert
        </p>
      )}
    </div>
  )
}
