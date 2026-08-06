"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { saveTfpPhotographer } from "../../actions"
import { btnCls, inputCls } from "@/components/ui"

/** Werkzeuge über dem TFP-Vertrag: Sprache, Fotograf-Block, Drucken (nicht im Druck). */
export function TfpTools({
  contactId,
  lang,
  photographer,
}: {
  contactId: string
  lang: "de" | "en"
  photographer: string
}) {
  const [text, setText] = useState(photographer)
  const [, start] = useTransition()

  return (
    <div className="space-y-2 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/recruit" className="text-sm text-fuchsia-400 hover:underline">
          ← Recruit-Pipeline
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/recruit/${contactId}/tfp?lang=de`}
            className={`rounded-lg px-2.5 py-1 text-sm ${lang === "de" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
          >
            Deutsch
          </Link>
          <Link
            href={`/recruit/${contactId}/tfp?lang=en`}
            className={`rounded-lg px-2.5 py-1 text-sm ${lang === "en" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
          >
            English
          </Link>
          <button onClick={() => window.print()} className={btnCls}>
            🖨 Drucken / PDF
          </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => start(() => saveTfpPhotographer(text))}
        rows={3}
        placeholder={"Fotograf:in-Block für den Vertrag, z.B.\nKünstlername / Studio\nStraße, PLZ Ort\nkontakt@…"}
        className={inputCls}
      />
      <p className="text-xs text-zinc-500">
        Muster-Dokument, keine Rechtsberatung — vor echtem Einsatz prüfen (lassen)
      </p>
    </div>
  )
}
