"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { staticCommands, filterCommands, type Command } from "@/lib/palette"
import { ModuleChip } from "@/components/ui"

/**
 * Command-Palette (⌘K / Ctrl+K): springen, suchen, handeln — überall.
 * Statische Kommandos sofort, Live-Treffer (Kontakte/Jobs/Artists/Events)
 * debounced aus /api/palette.
 */
export function CommandPalette() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [remote, setRemote] = useState<Command[]>([])
  const [index, setIndex] = useState(0)
  const [lastPath, setLastPath] = useState(pathname)
  const inputRef = useRef<HTMLInputElement>(null)
  const fetchSeq = useRef(0)

  const allStatic = useMemo(() => staticCommands(), [])
  const staticHits = useMemo(() => filterCommands(query, allStatic), [query, allStatic])

  const items = useMemo(() => {
    // Live-Treffer erst ab 2 Zeichen zeigen — darunter zählen nur statische Kommandos
    const list: Command[] = [...staticHits, ...(query.trim().length >= 2 ? remote : [])]
    if (query.trim().length >= 2) {
      list.push({
        label: `„${query.trim()}" überall suchen`,
        href: `/search?q=${encodeURIComponent(query.trim())}`,
        module: null,
        icon: "🔎",
      })
    }
    return list
  }, [staticHits, remote, query])

  const close = useCallback(() => {
    setOpen(false)
    setQuery("")
    setRemote([])
    setIndex(0)
  }, [])

  // Öffnen: ⌘K/Ctrl+K global + Klick auf den Nav-Button (Custom-Event)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === "Escape") {
        close()
      }
    }
    function onOpen() {
      setOpen(true)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("matchos:palette", onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("matchos:palette", onOpen)
    }
  }, [close])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Navigation schließt die Palette — Anpassung beim Render statt im Effekt
  if (pathname !== lastPath) {
    setLastPath(pathname)
    close()
  }

  // Live-Suche, debounced; veraltete Antworten werden verworfen
  useEffect(() => {
    if (!open || query.trim().length < 2) return
    const seq = ++fetchSeq.current
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/palette?q=${encodeURIComponent(query.trim())}`)
        if (!res.ok) return
        const data = (await res.json()) as { items: Command[] }
        if (seq === fetchSeq.current) setRemote(data.items ?? [])
      } catch {
        /* Netz weg — statische Kommandos reichen */
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query, open])

  function go(cmd: Command | undefined) {
    if (!cmd) return
    router.push(cmd.href)
    close()
  }

  if (!open || pathname.startsWith("/login")) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="mx-auto mt-[12vh] w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setIndex((i) => Math.min(i + 1, items.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === "Enter") {
              e.preventDefault()
              go(items[index])
            }
          }}
          placeholder="Wohin? Wen? Was? — tippen…"
          className="w-full border-b border-zinc-800 bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
        />
        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.map((c, i) => (
            <li key={`${c.href}-${c.label}`}>
              <button
                onClick={() => go(c)}
                onMouseEnter={() => setIndex(i)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${
                  i === index ? "bg-zinc-800 text-white" : "text-zinc-300"
                }`}
              >
                <span className="w-5 shrink-0 text-center">{c.icon}</span>
                <span className="min-w-0 flex-1 truncate">
                  {c.label}
                  {c.sub && <span className="ml-2 text-xs text-zinc-500">{c.sub}</span>}
                </span>
                {c.module && <ModuleChip module={c.module} />}
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-zinc-500">Kein Treffer</li>
          )}
        </ul>
        <p className="border-t border-zinc-800 px-4 py-1.5 text-[10px] text-zinc-600">
          ↑↓ wählen · Enter öffnen · Esc schließen
        </p>
      </div>
    </div>
  )
}
