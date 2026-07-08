"use client"

import { useState, useTransition } from "react"
import { saveAiBudget } from "@/lib/actions"
import { inputCls, btnCls } from "@/components/ui"

export function AiBudgetForm({ current }: { current: number }) {
  const [value, setValue] = useState(String(current))
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          await saveAiBudget(Number(value))
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        })
      }}
      className="flex items-end gap-2"
    >
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
      <button type="submit" disabled={pending} className={btnCls}>
        {saved ? "✓ Gespeichert" : pending ? "…" : "Speichern"}
      </button>
    </form>
  )
}
