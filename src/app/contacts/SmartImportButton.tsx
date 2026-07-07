"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { btnGhostCls, inputCls, btnCls } from "@/components/ui"

const PLATFORMS = ["tinder", "bumble", "hinge", "boo", "pairs", "tantan", "instagram", "sonstige"]

export function SmartImportButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState("")
  const [platform, setPlatform] = useState("tinder")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setError(null)
    const res = await fetch("/api/import/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw, platform }),
    })
    setLoading(false)
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Fehler")
      return
    }
    setOpen(false)
    setRaw("")
    router.push(`/contacts/${data.contactId}`)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={btnGhostCls}>
        Smart-Import
      </button>
      {open && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold">Smart-Import</h2>
            <p className="text-sm text-zinc-400">
              Profiltext und/oder Chatverlauf reinpasten — die KI erkennt Name, Alter,
              Ort, Interessen, Nachrichten und Gedächtnis-Einträge automatisch.
            </p>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={10}
              placeholder={"Mika, 26, Berlin\nKlettern, Ramen, Fotografie…\n\nMika: Hey, schönes Profil!\nich: Danke :) du kletterst auch?"}
              className={inputCls}
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-zinc-400">
                Abbrechen
              </button>
              <button onClick={submit} disabled={loading || !raw.trim()} className={btnCls}>
                {loading ? "Analysiere…" : "Importieren"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
