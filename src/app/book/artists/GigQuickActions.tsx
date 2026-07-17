"use client"

import { useTransition } from "react"
import type { Enums } from "@/lib/database.types"
import { advanceGig, cancelGig } from "@/lib/artistActions"
import { GIG_STATUS_LABELS, nextGigStatus } from "@/lib/artists"

// Kleine Weiter-/Absagen-Knöpfe für Pipeline-Zeilen und die Artist-Detailseite
export function GigQuickActions({
  gigId,
  artistId,
  status,
}: {
  gigId: string
  artistId: string
  status: Enums<"gig_status">
}) {
  const [pending, start] = useTransition()
  const next = nextGigStatus(status)
  if (status === "played" || status === "cancelled") return null

  return (
    <span className="flex items-center gap-1">
      {next && (
        <button
          disabled={pending}
          onClick={() => start(() => advanceGig(gigId, artistId, status))}
          title={`Weiter zu: ${GIG_STATUS_LABELS[next]}`}
          className="rounded-lg border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          → {GIG_STATUS_LABELS[next]}
        </button>
      )}
      <button
        disabled={pending}
        onClick={() => start(() => cancelGig(gigId, artistId))}
        title="Absagen"
        className="rounded-lg border border-zinc-800 px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-rose-400 disabled:opacity-50"
      >
        ✕
      </button>
    </span>
  )
}
