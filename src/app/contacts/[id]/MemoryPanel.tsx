"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { addMemory, deleteMemory } from "@/lib/actions"
import type { Tables, Enums } from "@/lib/database.types"
import { Card, inputCls, btnCls } from "@/components/ui"

const KIND_LABELS: Record<Enums<"memory_kind">, string> = {
  likes: "Mag",
  dislikes: "Mag nicht",
  fact: "Fakt",
  open_question: "Offene Frage",
  boundary: "Grenze",
  topic_works: "Thema funktioniert",
}

export function MemoryPanel({
  contactId,
  memories,
}: {
  contactId: string
  memories: Tables<"memories">[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [content, setContent] = useState("")
  const [kind, setKind] = useState<Enums<"memory_kind">>("fact")

  return (
    <Card title="Gedächtnis">
      <ul className="mb-3 space-y-1.5">
        {memories.map((m) => (
          <li key={m.id} className="group flex items-start gap-2 text-sm">
            <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
              {KIND_LABELS[m.kind]}
            </span>
            <span className="text-zinc-300">{m.content}</span>
            <button
              onClick={() =>
                start(async () => {
                  await deleteMemory(m.id, contactId)
                  router.refresh()
                })
              }
              className="ml-auto hidden text-zinc-600 hover:text-red-400 group-hover:block"
            >
              ×
            </button>
          </li>
        ))}
        {!memories.length && (
          <li className="text-sm text-zinc-500">Noch leer — füllt sich durch „Zusammenfassen“ oder manuell.</li>
        )}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!content.trim()) return
          start(async () => {
            await addMemory({ contact_id: contactId, kind, content: content.trim() })
            setContent("")
            router.refresh()
          })
        }}
        className="flex gap-2"
      >
        <select value={kind} onChange={(e) => setKind(e.target.value as Enums<"memory_kind">)} className={inputCls + " w-auto text-xs"}>
          {Object.entries(KIND_LABELS).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Neuer Eintrag" className={inputCls} />
        <button type="submit" disabled={pending} className={btnCls}>+</button>
      </form>
    </Card>
  )
}
