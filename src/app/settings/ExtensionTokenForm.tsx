"use client"

import { useState, useTransition } from "react"
import { saveSetting } from "@/lib/actions"
import { btnCls, btnGhostCls } from "@/components/ui"

export function ExtensionTokenForm({ current }: { current: string }) {
  const [token, setToken] = useState(current)
  const [show, setShow] = useState(false)
  const [pending, start] = useTransition()
  const [copied, setCopied] = useState(false)

  function generate() {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const t = "mox_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
    start(async () => {
      await saveSetting("extension_token", t)
      setToken(t)
      setShow(true)
    })
  }

  return (
    <div className="space-y-2">
      {token ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
            {show ? token : "mox_••••••••••••••••••••••••"}
          </code>
          <button onClick={() => setShow(!show)} className={btnGhostCls}>
            {show ? "Verbergen" : "Zeigen"}
          </button>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(token)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            className={btnGhostCls}
          >
            {copied ? "✓" : "Kopieren"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Noch kein Token erzeugt.</p>
      )}
      <button onClick={generate} disabled={pending} className={btnCls}>
        {token ? "Neu generieren (altes wird ungültig)" : "Token generieren"}
      </button>
      <p className="text-xs text-zinc-500">
        Token in der Browser-Extension (Zahnrad-Icon) eintragen. Bei Verlust einfach neu generieren.
      </p>
    </div>
  )
}
