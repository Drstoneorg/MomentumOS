"use client"

import { useState, useTransition } from "react"
import { saveSetting } from "@/lib/actions"
import { inputCls, btnCls } from "@/components/ui"

export function StyleForm({ current }: { current: string }) {
  const [value, setValue] = useState(current)
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          await saveSetting("user_style_profile", value)
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        })
      }}
      className="space-y-2"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={8}
        placeholder="z.B.: Locker, direkt, trockener Humor. Keine Emojis-Fluten. Kurze Nachrichten. Beispiele:&#10;- 'okay das klingt nach einem plan'&#10;- 'du kletterst? dann bist du schuld wenn ich mich blamiere'"
        className={inputCls}
      />
      <button type="submit" disabled={pending} className={btnCls}>
        {saved ? "✓ Gespeichert" : pending ? "…" : "Speichern"}
      </button>
    </form>
  )
}
