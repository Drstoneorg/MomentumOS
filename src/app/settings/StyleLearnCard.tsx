"use client"

import { useRef, useState } from "react"
import { inputCls, btnCls, btnGhostCls } from "@/components/ui"

type Learned = { profile: string; examples: string[] } | null

const SKIP = [
  "<medien ausgeschlossen>",
  "<media omitted>",
  "bild weggelassen",
  "image omitted",
  "video omitted",
  "audio omitted",
  "sticker omitted",
  "gif weggelassen",
  "du hast diese nachricht gelöscht",
  "this message was deleted",
  "nachrichten und anrufe sind ende-zu-ende-verschlüsselt",
]

function usable(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (!t || t.length < 2 || t.length > 500) return false
  if (SKIP.some((s) => t.includes(s))) return false
  if (/^https?:\/\/\S+$/.test(t)) return false
  return true
}

// WhatsApp-Export (.txt): iOS "[09.07.26, 14:23:11] Name: Text",
// Android "09.07.26, 14:23 - Name: Text". Mehrzeilige Nachrichten hängen
// an der Vorzeile ohne neuen Zeitstempel.
function parseWhatsApp(raw: string, myName: string): string[] {
  const out: string[] = []
  const lower = myName.trim().toLowerCase()
  let currentMine = false
  let current = ""
  const push = () => {
    if (currentMine && usable(current)) out.push(current.trim())
    current = ""
  }
  for (const line of raw.split("\n")) {
    const m =
      line.match(/^\[?[\d./]+,? [\d:]+(?:\s?[AP]M)?\]?\s*(?:- )?([^:]{1,40}): (.*)$/) ?? null
    if (m) {
      push()
      currentMine = m[1].trim().toLowerCase() === lower
      current = m[2]
    } else if (current) {
      current += "\n" + line
    }
  }
  push()
  return out
}

// Instagram-Datenexport (message_1.json): { participants, messages: [{sender_name, content}] }
// IG kodiert Umlaute als Latin-1-Mojibake ("fÃ¼r") — zurückkonvertieren.
function fixIgEncoding(s: string): string {
  try {
    return decodeURIComponent(escape(s))
  } catch {
    return s
  }
}

function parseInstagram(raw: string, myName: string): string[] {
  try {
    const data = JSON.parse(raw) as {
      messages?: { sender_name?: string; content?: string }[]
    }
    const lower = myName.trim().toLowerCase()
    return (data.messages ?? [])
      .filter(
        (m) =>
          m.content &&
          fixIgEncoding(m.sender_name ?? "").trim().toLowerCase() === lower
      )
      .map((m) => fixIgEncoding(m.content!))
      .filter(usable)
      .reverse() // IG-Export ist neueste zuerst
  } catch {
    return []
  }
}

export function StyleLearnCard({ current }: { current: Learned }) {
  const [myName, setMyName] = useState("")
  const [imported, setImported] = useState<string[]>([])
  const [fileInfo, setFileInfo] = useState("")
  const [pasted, setPasted] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [learned, setLearned] = useState<Learned>(current)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    if (!myName.trim()) {
      setError("Erst deinen Namen eintragen, genau wie er im Export steht.")
      return
    }
    setError(null)
    let msgs: string[] = []
    for (const f of Array.from(files)) {
      const text = await f.text()
      msgs = msgs.concat(
        f.name.endsWith(".json")
          ? parseInstagram(text, myName)
          : parseWhatsApp(text, myName)
      )
    }
    setImported(msgs)
    setFileInfo(
      msgs.length
        ? `${msgs.length} eigene Nachrichten aus ${files.length} Datei(en) erkannt`
        : `Keine Nachrichten von „${myName}“ gefunden — Name exakt wie im Export? (Groß-/Kleinschreibung egal)`
    )
  }

  async function learn() {
    setLoading(true)
    setError(null)
    const pastedMsgs = pasted
      .split("\n")
      .map((l) => l.trim())
      .filter(usable)
    const res = await fetch("/api/ai/learn-style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imported: [...imported, ...pastedMsgs] }),
    })
    setLoading(false)
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Fehler")
      return
    }
    setLearned({ profile: data.profile, examples: data.examples })
  }

  async function remove() {
    await fetch("/api/ai/learn-style", { method: "DELETE" })
    setLearned(null)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-lg border border-zinc-800 p-3">
        <p className="text-xs font-semibold uppercase text-zinc-500">
          1. Optional: Chat-Exporte hochladen (WhatsApp .txt / Instagram .json)
        </p>
        <p className="text-xs text-zinc-500">
          WhatsApp: Chat öffnen → ⋮ → Mehr → Chat exportieren → ohne Medien.
          Instagram: Konto → Deine Aktivität → Informationen herunterladen (JSON) →
          messages-Ordner → message_1.json. Es werden NUR deine eigenen Nachrichten
          verwendet, nichts wird gespeichert außer dem gelernten Profil.
        </p>
        <div className="flex gap-2">
          <input
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="Dein Name, exakt wie im Export (z. B. Effy)"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={btnGhostCls + " whitespace-nowrap"}
          >
            Dateien wählen
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.json"
            multiple
            hidden
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>
        {fileInfo && <p className="text-xs text-emerald-400">{fileInfo}</p>}
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={3}
          placeholder="Oder hier 5-10 eigene Nachrichten einfügen, eine pro Zeile — am besten welche, die gut ankamen"
          className={inputCls}
        />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={learn} disabled={loading} className={btnCls}>
          {loading ? "Analysiere…" : "Stil aus meinen Nachrichten lernen"}
        </button>
        <span className="text-xs text-zinc-500">
          nutzt auch alle bereits gesyncten Chats (deine gesendeten Nachrichten)
        </span>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {learned && (
        <div className="space-y-2 rounded-lg bg-zinc-950 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase text-emerald-400">
              Gelerntes Profil (fließt automatisch in jeden Vorschlag ein)
            </p>
            <button onClick={remove} className={btnGhostCls + " shrink-0 text-xs"}>
              Löschen
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm text-zinc-300">{learned.profile}</p>
          {learned.examples.length > 0 && (
            <>
              <p className="pt-1 text-xs font-semibold uppercase text-zinc-500">
                Beispiele ({learned.examples.length})
              </p>
              <ul className="space-y-1 text-xs text-zinc-400">
                {learned.examples.map((e, i) => (
                  <li key={i}>„{e}“</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
