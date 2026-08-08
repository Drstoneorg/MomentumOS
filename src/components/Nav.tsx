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
  const [open, setOpen] = useState(false) // Modul-Dropdown links
  const [menuOpen, setMenuOpen] = useState(false) // ☰-Menü am Handy
  const [lastPath, setLastPath] = useState(pathname)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Navigation schließt beide Menüs — Anpassung beim Render statt im Effekt
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
    setMenuOpen(false)
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  async function logout() {
    await createClient().auth.signOut()
    router.push("/login")
    router.refresh()
  }

  // /model ist die öffentliche Landing-Page — dort keine App-Navigation zeigen
  if (
    pathname.startsWith("/login") ||
    pathname === "/model" ||
    pathname.startsWith("/einladung") ||
    pathname.startsWith("/e/") ||
    pathname.startsWith("/tuer/")
  )
    return null

  const active = sectionForPath(pathname)

  const linkCls = (href: string) =>
    `rounded-lg px-3 py-1.5 text-sm ${
      pathname === href ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
    }`

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

      {/* Ab sm: Linkleiste wie gehabt. Am Handy übernimmt das ☰-Menü. */}
      <div className="hidden items-center gap-1 sm:flex">
        {active.links.map((l) => (
          <Link key={l.href} href={l.href} className={linkCls(l.href)}>
            {l.label}
          </Link>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Link
          href="/inbox"
          title="Inbox — alle Signale aller Module"
          className={`hidden sm:block ${linkCls("/inbox")} !px-2`}
        >
          📥 Inbox
        </Link>
        <Link
          href="/ask"
          title="Fragen — Freitext über alle Module"
          className={`hidden sm:block ${linkCls("/ask")} !px-2`}
        >
          🔮 Fragen
        </Link>
        <button
          onClick={() => window.dispatchEvent(new Event("momentumos:palette"))}
          title="Befehle & Suche (⌘K)"
          className="hidden items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-500 hover:text-zinc-200 sm:flex"
        >
          🔎
          <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 text-[10px] text-zinc-400">⌘K</kbd>
        </button>
        <span className="hidden sm:block">
          <QuickAddContact />
        </span>
        <button
          onClick={logout}
          className="hidden rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-white sm:block"
        >
          Logout
        </button>

        {/* Handy: alles hinter einem Knopf, statt rechts aus dem Bild zu laufen */}
        <div ref={menuRef} className="sm:hidden">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menü"
            aria-expanded={menuOpen}
            className={`rounded-lg border px-2.5 py-1.5 text-sm ${
              menuOpen
                ? "border-zinc-600 bg-zinc-800 text-white"
                : "border-zinc-800 text-zinc-300"
            }`}
          >
            ☰
          </button>
          {menuOpen && (
            <div className="absolute inset-x-0 top-full border-b border-zinc-800 bg-zinc-950/95 px-4 pb-4 pt-2 shadow-xl backdrop-blur">
              <div className="space-y-0.5">
                {active.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`block rounded-lg px-3 py-2.5 text-sm ${
                      pathname === l.href ? "bg-zinc-800 text-white" : "text-zinc-300"
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
              <div className="my-2 border-t border-zinc-800" />
              <div className="space-y-0.5">
                <Link
                  href="/inbox"
                  className={`block rounded-lg px-3 py-2.5 text-sm ${
                    pathname === "/inbox" ? "bg-zinc-800 text-white" : "text-zinc-300"
                  }`}
                >
                  📥 Inbox
                </Link>
                <Link
                  href="/ask"
                  className={`block rounded-lg px-3 py-2.5 text-sm ${
                    pathname === "/ask" ? "bg-zinc-800 text-white" : "text-zinc-300"
                  }`}
                >
                  🔮 Fragen
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    window.dispatchEvent(new Event("momentumos:palette"))
                  }}
                  className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-zinc-300"
                >
                  🔎 Suche
                </button>
              </div>
              <div className="my-2 border-t border-zinc-800" />
              <div className="flex items-center justify-between px-1">
                <QuickAddContact />
                <button onClick={logout} className="rounded-lg px-3 py-2 text-sm text-zinc-500">
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
