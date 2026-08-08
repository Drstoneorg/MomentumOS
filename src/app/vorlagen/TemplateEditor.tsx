"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { saveTemplate } from "@/lib/momentsActions"
import { Card, btnCls } from "@/components/ui"

/**
 * Editor für einen Vorlagen-Schlüssel (z. B. Einladung Deutsch): Variante A
 * ist der Standard, eine gefüllte Variante B schaltet den A/B-Wechsel scharf.
 * B leeren beendet den Test.
 */
export function TemplateEditor({
  titel,
  vorlageKey,
  lang,
  varianteA,
  varianteB,
}: {
  titel: string
  vorlageKey: string
  lang: "de" | "en"
  varianteA: string
  varianteB: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [a, setA] = useState(varianteA)
  const [b, setB] = useState(varianteB)
  const [meldung, setMeldung] = useState<string | null>(null)

  const geaendert = a !== varianteA || b !== varianteB
  const stilWarnung = [a, b]
    .filter(Boolean)
    .some((t) => /[.]\s*$/.test(t.trim()) || t.includes("—") || t.includes("–"))

  function speichern() {
    start(async () => {
      setMeldung(null)
      try {
        await saveTemplate({ key: vorlageKey, lang, variant: "A", text: a })
        await saveTemplate({ key: vorlageKey, lang, variant: "B", text: b })
        setMeldung("Gespeichert — gilt ab dem nächsten Entwurf")
        router.refresh()
      } catch (e) {
        setMeldung(e instanceof Error ? e.message : "Speichern fehlgeschlagen")
      }
    })
  }

  return (
    <Card title={titel}>
      <div className="space-y-2">
        <label className="block text-xs text-zinc-500">
          Variante A (Standard)
          <textarea
            value={a}
            onChange={(e) => setA(e.target.value)}
            rows={3}
            maxLength={1000}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Variante B (leer = kein A/B-Test)
          <textarea
            value={b}
            onChange={(e) => setB(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Zweite Textfassung — wechselt sich beim Einladen mit A ab"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
          />
        </label>
        <div className="flex items-center gap-3">
          <button className={btnCls} disabled={pending || !geaendert || !a.trim()} onClick={speichern}>
            {pending ? "…" : "Speichern"}
          </button>
          {stilWarnung && (
            <span className="text-xs text-amber-300">
              ⚠ Stilregel: kein Punkt am Satzende, keine Gedankenstriche
            </span>
          )}
          {meldung && <span className="text-xs text-emerald-400">{meldung}</span>}
        </div>
      </div>
    </Card>
  )
}
