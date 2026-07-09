"use client"

import { useState, useTransition } from "react"
import { saveSetting } from "@/lib/actions"
import { inputCls, btnCls } from "@/components/ui"

export function StyleRulesForm({ current }: { current: string }) {
  const [value, setValue] = useState(current)
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          await saveSetting("user_style_rules", value)
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        })
      }}
      className="space-y-2"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder={
          "Eine Regel pro Zeile, z. B.:\nKeine Emojis außer 😅\nNie mit Frage enden wenn sie kurz angebunden ist\nImmer klein schreiben"
        }
        className={inputCls}
      />
      <button type="submit" disabled={pending} className={btnCls}>
        {saved ? "✓ Gespeichert" : pending ? "…" : "Speichern"}
      </button>
    </form>
  )
}
