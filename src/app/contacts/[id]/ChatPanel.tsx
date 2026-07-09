"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { addMessage, importChat, deleteMessage, clearMessages } from "@/lib/actions"
import type { Tables } from "@/lib/database.types"
import { Card, inputCls, btnCls, btnGhostCls } from "@/components/ui"

const CHANNELS = ["dating_app", "telegram", "whatsapp", "instagram", "tiktok", "snapchat", "wechat"]

export function ChatPanel({
  contactId,
  messages,
}: {
  contactId: string
  messages: Tables<"messages">[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [text, setText] = useState("")
  const [direction, setDirection] = useState<"in" | "out">("in")
  const [channel, setChannel] = useState("dating_app")
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState("")
  const [summarizing, setSummarizing] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    start(async () => {
      await addMessage({ contact_id: contactId, direction, channel, content: text.trim() })
      setText("")
      router.refresh()
    })
  }

  async function summarize() {
    setSummarizing(true)
    const res = await fetch("/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    })
    setSummarizing(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Fehler" }))
      alert(`Zusammenfassung fehlgeschlagen: ${error}`)
      return
    }
    router.refresh()
  }

  return (
    <Card title="Chatverlauf">
      {messages.length > 0 && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (confirm(`Alle ${messages.length} Nachrichten dieses Kontakts löschen? (Profil, Bio, Interessen bleiben erhalten.)`)) {
                start(async () => {
                  await clearMessages(contactId)
                  router.refresh()
                })
              }
            }}
            className="text-xs text-zinc-600 hover:text-red-400"
          >
            Alle Nachrichten löschen
          </button>
        </div>
      )}
      <div className="mb-3 flex max-h-96 flex-col gap-2 overflow-y-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`group relative max-w-[80%] rounded-xl px-3 py-2 text-sm ${
              m.direction === "out"
                ? "self-end bg-rose-900/50 text-rose-100"
                : "self-start bg-zinc-800 text-zinc-200"
            }`}
          >
            <button
              type="button"
              title="Nachricht löschen"
              onClick={() =>
                start(async () => {
                  await deleteMessage(m.id, contactId)
                  router.refresh()
                })
              }
              className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-xs text-zinc-200 hover:bg-red-600 group-hover:flex"
            >
              ✕
            </button>
            {m.content}
            <div className="mt-1 text-[10px] text-zinc-500">
              {m.channel} · {new Date(m.sent_at).toLocaleString("de-DE")}
            </div>
          </div>
        ))}
        {!messages.length && (
          <p className="py-6 text-center text-sm text-zinc-500">
            Noch keine Nachrichten. Einzeln hinzufügen oder Chat importieren.
          </p>
        )}
      </div>

      <form onSubmit={submit} className="space-y-2">
        <div className="flex gap-2">
          <select value={direction} onChange={(e) => setDirection(e.target.value as "in" | "out")} className={inputCls + " w-auto"}>
            <option value="in">Von ihr/ihm</option>
            <option value="out">Von mir</option>
          </select>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls + " w-auto"}>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="button" onClick={() => setShowImport(!showImport)} className={btnGhostCls + " ml-auto"}>
            Import
          </button>
          <button type="button" onClick={summarize} disabled={summarizing || !messages.length} className={btnGhostCls}>
            {summarizing ? "…" : "Zusammenfassen"}
          </button>
        </div>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nachricht eintragen…"
            className={inputCls}
          />
          <button type="submit" disabled={pending} className={btnCls}>+</button>
        </div>
      </form>

      {showImport && (
        <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs text-zinc-500">
            Chat einfügen — eine Nachricht pro Zeile. Eigene Nachrichten mit{" "}
            <code className="text-zinc-300">ich:</code> beginnen, Rest gilt als eingehend.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            className={inputCls}
            placeholder={"Hey, wie war dein Tag?\nich: Ganz gut, war klettern"}
          />
          <button
            onClick={() =>
              start(async () => {
                const n = await importChat(contactId, importText, channel)
                setImportText("")
                setShowImport(false)
                router.refresh()
                if (!n) alert("Nichts importiert")
              })
            }
            disabled={pending || !importText.trim()}
            className={btnCls}
          >
            Importieren
          </button>
        </div>
      )}
    </Card>
  )
}
