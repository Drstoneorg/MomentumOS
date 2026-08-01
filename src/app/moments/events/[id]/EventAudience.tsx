"use client"

import { updateEvent } from "@/lib/momentsActions"
import { InlineField } from "@/components/InlineField"

/** Zielpublikum als eigene Zeile im Event-Kopf — Basis für die DJ-Passung. */
export function EventAudience({ eventId, audience }: { eventId: string; audience: string | null }) {
  return (
    <p className="mt-1 text-sm text-zinc-400">
      🎯 Zielpublikum:{" "}
      <InlineField
        value={audience ?? ""}
        placeholder="z. B. Goth/Alt-Szene 20–30, tanzfreudig, eher queer"
        onSave={(v) => updateEvent(eventId, { audience: v || null })}
      />
    </p>
  )
}
