"use client"

import { useRef, useState, useTransition } from "react"
import { uploadCardTemplate, deleteCardTemplate } from "@/lib/cardActions"
import type { Tables } from "@/lib/database.types"
import { btnGhostCls } from "@/components/ui"

export function TemplateManager({ templates }: { templates: Tables<"card_templates">[] }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState("")
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="font-semibold text-white">Karten-Vorlagen</h2>
      <p className="text-xs text-zinc-500">
        Eigene TCG-Vorlage (Rahmen/Layout) hochladen — die KI behält das Design und tauscht nur
        Artwork, Namen, Effekt und Werte aus.
      </p>

      <form
        ref={formRef}
        action={(fd) =>
          start(async () => {
            setError("")
            try {
              await uploadCardTemplate(fd)
              formRef.current?.reset()
            } catch (e) {
              setError(e instanceof Error ? e.message : "Upload-Fehler")
            }
          })
        }
        className="flex flex-wrap items-center gap-2"
      >
        <input
          name="name"
          placeholder="Name der Vorlage"
          required
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200"
        />
        <input
          name="style_notes"
          placeholder="Stil-Hinweise (optional)"
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200"
        />
        <input name="file" type="file" accept="image/*" required className="text-sm text-zinc-400" />
        <button type="submit" disabled={pending} className={btnGhostCls}>
          {pending ? "Lädt…" : "Hochladen"}
        </button>
      </form>
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {templates.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {templates.map((t) => (
            <div key={t.id} className="w-36 space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.image_url} alt={t.name} className="rounded-lg border border-zinc-700" />
              <div className="flex items-center gap-1">
                <span className="truncate text-xs text-zinc-300">{t.name}</span>
                <button
                  onClick={() => start(() => deleteCardTemplate(t.id))}
                  className="ml-auto text-xs text-zinc-600 hover:text-rose-400"
                  title="Vorlage löschen"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
