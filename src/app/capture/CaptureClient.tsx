"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { channelDeepLink } from "@/lib/channels"
import { btnCls, btnGhostCls, inputCls } from "@/components/ui"

type ItemResult = {
  contactId: string
  name: string
  isNew: boolean
  kind: string
  birthday: string | null
  channels: { channel: string; handle: string }[]
  addedChannels: number
}

type Item = {
  id: string
  label: string
  preview: string | null // data-URL fürs Thumbnail
  status: "wartet" | "läuft" | "fertig" | "fehler"
  result?: ItemResult
  error?: string
  payload: { image?: string; text?: string }
}

// Bilder vor dem Upload verkleinern — Vision braucht keine 12-MP-Fotos.
async function downscale(file: File, maxDim = 1600): Promise<string> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = dataUrl
  })
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  if (scale >= 1) return dataUrl
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/jpeg", 0.85)
}

export function CaptureClient() {
  const [items, setItems] = useState<Item[]>([])
  const [text, setText] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const runningRef = useRef(false)

  const addFiles = useCallback(async (files: File[]) => {
    for (const f of files) {
      if (!f.type.startsWith("image/")) continue
      const image = await downscale(f)
      setItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          label: f.name || "Bild",
          preview: image,
          status: "wartet",
          payload: { image },
        },
      ])
    }
  }, [])

  function addText() {
    if (!text.trim()) return
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: text.trim().slice(0, 60),
        preview: null,
        status: "wartet",
        payload: { text: text.trim() },
      },
    ])
    setText("")
  }

  // Ctrl+V: Screenshots direkt aus der Zwischenablage
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = [...(e.clipboardData?.files ?? [])]
      if (files.length) {
        e.preventDefault()
        addFiles(files)
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [addFiles])

  // Warteschlange sequenziell abarbeiten — automatisch, kein Extra-Klick.
  useEffect(() => {
    if (runningRef.current) return
    const next = items.find((i) => i.status === "wartet")
    if (!next) return
    runningRef.current = true
    setItems((prev) => prev.map((i) => (i.id === next.id ? { ...i, status: "läuft" } : i)))
    ;(async () => {
      try {
        const res = await fetch("/api/import/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next.payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Fehler")
        setItems((prev) =>
          prev.map((i) => (i.id === next.id ? { ...i, status: "fertig", result: data } : i))
        )
      } catch (e) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === next.id
              ? { ...i, status: "fehler", error: e instanceof Error ? e.message : "Fehler" }
              : i
          )
        )
      } finally {
        runningRef.current = false
        setItems((prev) => [...prev]) // Effect erneut triggern
      }
    })()
  }, [items])

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          addFiles([...e.dataTransfer.files])
        }}
        onClick={() => fileRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center text-sm transition ${
          dragOver ? "border-rose-500 bg-rose-950/20 text-rose-200" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
        }`}
      >
        <p className="font-medium">Bilder hierher ziehen, klicken zum Auswählen</p>
        <p className="mt-1 text-xs text-zinc-500">
          oder Screenshot mit Strg/Cmd+V einfügen · am Handy öffnet sich die Kamera
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          hidden
          onChange={(e) => {
            addFiles([...(e.target.files ?? [])])
            e.target.value = ""
          }}
        />
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addText()}
          placeholder='Oder Text: "Anna Huber +43 660 1234567, anna@mail.at, Geb. 12.5.1995"'
          className={inputCls}
        />
        <button onClick={addText} disabled={!text.trim()} className={btnCls}>
          Erfassen
        </button>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {[...items].reverse().map((i) => (
            <div key={i.id} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              {i.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.preview} alt="" className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-zinc-800 text-lg">📝</div>
              )}
              <div className="min-w-0 flex-1 text-sm">
                {i.status === "wartet" && <p className="text-zinc-500">Wartet… {i.label}</p>}
                {i.status === "läuft" && <p className="text-zinc-400">KI liest aus… {i.label}</p>}
                {i.status === "fehler" && <p className="text-rose-400">✗ {i.error}</p>}
                {i.status === "fertig" && i.result && (
                  <>
                    <p>
                      <Link href={`/contacts/${i.result.contactId}`} className="font-medium text-white hover:underline">
                        {i.result.name}
                      </Link>{" "}
                      <span className="text-zinc-500">
                        {i.result.isNew ? "angelegt" : "aktualisiert (Duplikat erkannt)"}
                        {i.result.kind !== "unbekannt" ? ` · ${i.result.kind}` : ""}
                        {i.result.birthday ? ` · 🎂 ${i.result.birthday}` : ""}
                        {i.result.addedChannels ? ` · ${i.result.addedChannels} Kanal/Kanäle neu` : ""}
                      </span>
                    </p>
                    {i.result.channels.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {i.result.channels.map((c) => {
                          const link = channelDeepLink(c.channel, c.handle)
                          return link.url ? (
                            <a
                              key={c.channel + c.handle}
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              title={link.hint}
                              className={btnGhostCls + " !px-2 !py-0.5 !text-xs"}
                            >
                              {link.label} ↗
                            </a>
                          ) : (
                            <span key={c.channel + c.handle} className="rounded border border-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
                              {c.channel}: {c.handle}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
