"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { QuickAddContact } from "@/components/QuickAddContact"
import { MODULES, PLATFORM, sectionForPath } from "@/lib/modules"

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [lastPath, setLastPath] = useState(pathname)
  const ref = useRef<HTMLDivElement>(null)

  // Navigation schließt das Menü — Anpassung beim Render statt im Effekt
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  async function logout() {
    await createClient().auth.signOut()
    router.push("/login")
    router.refresh()
  }

  if (pathname.startsWith("/login")) return null

  const active = sectionForPath(pathname)

  return (
    <nav className="sticky top-0 z-20 flex items-center gap-1 border-b border-zinc-800 bg-zinc-950/90 px-4 py-2 backdrop-blur">
      <div ref={ref} className="relative mr-4">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1 font-bold ${active.text}`}
        >
          {active.label}
          <svg width="12" height="12" viewBox="0 0 12 12" className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
            {[PLATFORM, ...MODULES].map((m) => (
              <Link
                key={m.id}
                href={m.home}
                className={`block px-4 py-2.5 text-sm hover:bg-zinc-800 ${
                  m.id === "platform" ? "border-b border-zinc-800" : ""
                } ${m.id === active.id ? `font-semibold ${m.text}` : "text-zinc-300"}`}
              >
                <span className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                  {m.label}
                </span>
                <span className="block pl-3.5 text-[10px] font-normal text-zinc-500">{m.tagline}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
      {active.links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            pathname === l.href
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          {l.label}
        </Link>
      ))}
      <Link
        href="/inbox"
        title="Inbox — alle Signale aller Module"
        className={`ml-auto rounded-lg px-2 py-1.5 text-sm ${
          pathname === "/inbox" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
        }`}
      >
        📥 Inbox
      </Link>
      <Link
        href="/ask"
        title="Fragen — Freitext über alle Module"
        className={`rounded-lg px-2 py-1.5 text-sm ${
          pathname === "/ask" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
        }`}
      >
        🔮 Fragen
      </Link>
      <button
        onClick={() => window.dispatchEvent(new Event("momentumos:palette"))}
        title="Befehle & Suche (⌘K)"
        className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-500 hover:text-zinc-200"
      >
        🔎
        <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 text-[10px] text-zinc-400">⌘K</kbd>
      </button>
      <QuickAddContact />
      <button
        onClick={logout}
        className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-white"
      >
        Logout
      </button>
    </nav>
  )
}
