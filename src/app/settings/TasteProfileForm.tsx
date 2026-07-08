"use client"

import { useState, useTransition } from "react"
import { saveTasteProfile } from "@/lib/actions"
import { inputCls, btnCls } from "@/components/ui"

export function TasteProfileForm({
  current,
}: {
  current: { include: string[]; avoid: string[]; autoLikeHint: boolean }
}) {
  const [include, setInclude] = useState(current.include.join(", "))
  const [avoid, setAvoid] = useState(current.avoid.join(", "))
  const [autoLikeHint, setAutoLikeHint] = useState(current.autoLikeHint)
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)

  const parse = (s: string) =>
    s.split(/[,\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          await saveTasteProfile({
            include: parse(include),
            avoid: parse(avoid),
            autoLikeHint,
          })
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        })
      }}
      className="space-y-3"
    >
      <div>
        <label className="mb-1 block text-xs text-zinc-500">
          Passt-zu-mir Stichwörter (kommagetrennt) — Bio wird darauf geprüft
        </label>
        <textarea
          value={include}
          onChange={(e) => setInclude(e.target.value)}
          rows={3}
          placeholder="blond, platinblond, weiße haare, goth, alternative, alt, e-girl, punk, emo, grunge, tattoos, piercings, aesthetic, egirl, gothic"
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-zinc-500">
          Ausschluss-Stichwörter (optional) — Treffer = keine Empfehlung
        </label>
        <textarea
          value={avoid}
          onChange={(e) => setAvoid(e.target.value)}
          rows={2}
          placeholder="z.B. Themen/Wörter, bei denen du nie liken willst"
          className={inputCls}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={autoLikeHint} onChange={(e) => setAutoLikeHint(e.target.checked)} />
        Bei Treffer den Like-Button im Overlay hervorheben
      </label>
      <button type="submit" disabled={pending} className={btnCls}>
        {saved ? "✓ Gespeichert" : pending ? "…" : "Speichern"}
      </button>
      <p className="text-xs text-zinc-600">
        Die Extension prüft nur den sichtbaren Bio-/Profiltext — Foto-Analyse (Haarfarbe/Style)
        braucht später einen Vision-Key. Der Like wird nie automatisch ausgelöst: du klickst.
      </p>
    </form>
  )
}
