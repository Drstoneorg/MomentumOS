"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { saveOrganizerProfile } from "@/lib/artistActions"
import { btnCls, inputCls } from "@/components/ui"

/** Werkzeuge über dem Vertrag: Veranstalter-Block pflegen + Drucken (nicht im Druck). */
export function ContractTools({
  artistId,
  organizer,
}: {
  artistId: string
  organizer: string
}) {
  const [text, setText] = useState(organizer)
  const [, start] = useTransition()

  return (
    <div className="space-y-2 print:hidden">
      <div className="flex items-center justify-between">
        <Link href={`/book/artists/${artistId}`} className="text-sm text-sky-400 hover:underline">
          ← Artist
        </Link>
        <button onClick={() => window.print()} className={btnCls}>
          🖨 Drucken / PDF
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => start(() => saveOrganizerProfile(text))}
        rows={3}
        placeholder={"Veranstalter-Block für den Vertrag, z.B.\nMax Mustermann\nMusterstraße 1, 1010 Wien\nkontakt@…"}
        className={inputCls}
      />
      <p className="text-xs text-zinc-500">
        Muster-Dokument, keine Rechtsberatung — vor echtem Einsatz prüfen (lassen)
      </p>
    </div>
  )
}
