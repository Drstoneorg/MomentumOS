"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { markSuggestionSent, updateSuggestion } from "@/lib/actions"
import { channelDeepLink } from "@/lib/channels"
import type { Tables } from "@/lib/database.types"
import { btnCls, btnGhostCls } from "@/components/ui"

export function QueueItem({
  suggestion,
  contactName,
  channels = [],
}: {
  suggestion: Tables<"suggestions">
  contactName: string
  channels?: { channel: string; handle: string }[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const variants = (suggestion.variants ?? {}) as Record<string, string>
  const [chosen, setChosen] = useState(
    suggestion.chosen_variant ?? Object.keys(variants)[0] ?? ""
  )
  const isApproved = suggestion.status === "approved"

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Link href={`/contacts/${suggestion.contact_id}`} className="font-medium text-white hover:underline">
          {contactName}
        </Link>
        <span className="text-xs text-zinc-500">
          {new Date(suggestion.created_at).toLocaleString("de-DE")}
        </span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-xs ${
            suggestion.auto_send_at && !isApproved
              ? "bg-rose-900/60 text-rose-300"
              : isApproved
                ? "bg-amber-900/60 text-amber-300"
                : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {suggestion.auto_send_at && !isApproved
            ? `⚡ Autopilot — sendet ${new Date(suggestion.auto_send_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
            : isApproved
              ? "Freigegeben — wartet auf Worker"
              : "Entwurf"}
        </span>
      </div>
      {suggestion.situation && (
        <p className="mb-2 text-xs text-zinc-500">Situation: {suggestion.situation}</p>
      )}

      <div className="space-y-2">
        {Object.entries(variants).map(([style, text]) => (
          <label
            key={style}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 ${
              chosen === style ? "border-rose-600 bg-rose-950/20" : "border-zinc-800"
            }`}
          >
            <input
              type="radio"
              checked={chosen === style}
              onChange={() => setChosen(style)}
              disabled={isApproved}
              className="mt-1"
            />
            <div>
              <span className="text-xs font-semibold uppercase text-rose-400">{style}</span>
              <p className="text-sm text-zinc-200">{text}</p>
            </div>
          </label>
        ))}
      </div>

      {chosen && variants[chosen] && channels.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
          <span className="text-xs text-zinc-500">Direkt öffnen:</span>
          {channels.map((c) => {
            const link = channelDeepLink(c.channel, c.handle, variants[chosen])
            if (!link.url) return null
            return (
              <a
                key={c.channel + c.handle}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                title={link.hint}
                onClick={() => navigator.clipboard.writeText(variants[chosen])}
                className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                {link.label} ↗
              </a>
            )
          })}
          <span className="text-[10px] text-zinc-600">
            Text wird beim Klick in die Zwischenablage kopiert
          </span>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {!isApproved && (
          <>
            <button
              onClick={() =>
                start(async () => {
                  await updateSuggestion(suggestion.id, {
                    status: "approved",
                    chosen_variant: chosen,
                  })
                  router.refresh()
                })
              }
              disabled={pending || !chosen}
              className={btnCls}
            >
              Freigeben & senden
            </button>
            {suggestion.auto_send_at && (
              <button
                onClick={() =>
                  start(async () => {
                    await updateSuggestion(suggestion.id, { auto_send_at: null })
                    router.refresh()
                  })
                }
                disabled={pending}
                className="rounded-lg border border-rose-700 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-950"
              >
                ✋ Autopilot stoppen
              </button>
            )}
            <button
              onClick={() =>
                start(async () => {
                  await updateSuggestion(suggestion.id, { status: "discarded" })
                  router.refresh()
                })
              }
              disabled={pending}
              className={btnGhostCls}
            >
              Verwerfen
            </button>
          </>
        )}
        {isApproved && (
          <>
            {suggestion.channel !== "telegram" && (
              <button
                onClick={() =>
                  start(async () => {
                    await markSuggestionSent(suggestion.id)
                    router.refresh()
                  })
                }
                disabled={pending}
                className={btnCls}
              >
                ✓ Habe gesendet
              </button>
            )}
            <button
              onClick={() =>
                start(async () => {
                  await updateSuggestion(suggestion.id, { status: "draft" })
                  router.refresh()
                })
              }
              disabled={pending}
              className={btnGhostCls}
            >
              Freigabe zurückziehen
            </button>
          </>
        )}
      </div>
    </div>
  )
}
