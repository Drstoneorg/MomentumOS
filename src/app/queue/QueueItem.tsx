"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { updateSuggestion } from "@/lib/actions"
import type { Tables } from "@/lib/database.types"
import { btnCls, btnGhostCls } from "@/components/ui"

export function QueueItem({
  suggestion,
  contactName,
}: {
  suggestion: Tables<"suggestions">
  contactName: string
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
            isApproved ? "bg-amber-900/60 text-amber-300" : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {isApproved ? "Freigegeben — wartet auf Worker" : "Entwurf"}
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
        )}
      </div>
    </div>
  )
}
