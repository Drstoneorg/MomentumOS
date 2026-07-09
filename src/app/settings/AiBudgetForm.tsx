"use client"

import { useState, useTransition } from "react"
import { saveAiBudget } from "@/lib/actions"
import { inputCls, btnCls } from "@/components/ui"

export function AiBudgetForm({
  current,
  currentImageCost,
}: {
  current: number
  currentImageCost: number | null
}) {
  const [value, setValue] = useState(String(current))
  const [imgCost, setImgCost] = useState(currentImageCost != null ? String(currentImageCost) : "")
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          await saveAiBudget(Number(value), imgCost.trim() ? Number(imgCost) : null)
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        })
      }}
      className="space-y-2"
    >
      <div className="flex items-end gap-2">
        <label className="flex-1 text-sm text-zinc-400">
          Monatslimit (USD)
          <input
            type="number"
            min={0}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex-1 text-sm text-zinc-400">
          Echter Preis pro Bild (USD, optional)
          <input
            type="number"
            min={0}
            step="0.001"
            value={imgCost}
            onChange={(e) => setImgCost(e.target.value)}
            placeholder="z. B. 0.014"
            className={inputCls}
          />
        </label>
        <button type="submit" disabled={pending} className={btnCls}>
          {saved ? "✓ Gespeichert" : pending ? "…" : "Speichern"}
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Kalibrierung: OpenAI-Dashboard → Usage → Bildkosten eines Tages ÷ Anzahl Bilder.
        Leer = Token-Schätzung. Gilt für neue Bilder ab Speichern.
      </p>
    </form>
  )
}
