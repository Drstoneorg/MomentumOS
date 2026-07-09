"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { QuickAddContact } from "@/components/QuickAddContact"

type Product = {
  id: string
  label: string
  color: string
  home: string
  match: (p: string) => boolean
  links: { href: string; label: string }[]
}

const products: Product[] = [
  {
    id: "dating",
    label: "MatchOS",
    color: "text-rose-500",
    home: "/",
    match: (p) =>
      p === "/" ||
      p.startsWith("/contacts") ||
      p.startsWith("/pipeline") ||
      p.startsWith("/queue") ||
      p.startsWith("/cards") ||
      p.startsWith("/settings"),
    links: [
      { href: "/", label: "Dashboard" },
      { href: "/contacts", label: "Matchbox" },
      { href: "/pipeline", label: "Pipeline" },
      { href: "/queue", label: "Queue" },
      { href: "/cards", label: "Karten" },
      { href: "/settings", label: "Einstellungen" },
    ],
  },
  {
    id: "moments",
    label: "Moments",
    color: "text-amber-400",
    home: "/moments",
    match: (p) => p.startsWith("/moments"),
    links: [
      { href: "/moments", label: "Hub" },
      { href: "/moments/events", label: "Events" },
      { href: "/moments/meetups", label: "Meetups" },
      { href: "/cards", label: "Karten" },
      { href: "/contacts", label: "Kontakte" },
    ],
  },
  {
    id: "book",
    label: "BookOS",
    color: "text-sky-400",
    home: "/book",
    match: (p) => p.startsWith("/book") || p.startsWith("/provider"),
    links: [
      { href: "/book", label: "Treatment buchen" },
      { href: "/book/bookings", label: "Meine Buchungen" },
      { href: "/provider", label: "Anbieter" },
    ],
  },
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => setOpen(false), [pathname])
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

  const active =
    products.find((pr) => pr.id !== "dating" && pr.match(pathname)) ?? products[0]

  return (
    <nav className="sticky top-0 z-20 flex items-center gap-1 border-b border-zinc-800 bg-zinc-950/90 px-4 py-2 backdrop-blur">
      <div ref={ref} className="relative mr-4">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1 font-bold ${active.color}`}
        >
          {active.label}
          <svg width="12" height="12" viewBox="0 0 12 12" className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-2 w-44 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
            {products.map((pr) => (
              <Link
                key={pr.id}
                href={pr.home}
                className={`block px-4 py-2.5 text-sm hover:bg-zinc-800 ${
                  pr.id === active.id ? `font-semibold ${pr.color}` : "text-zinc-300"
                }`}
              >
                {pr.label}
                <span className="block text-[10px] font-normal text-zinc-500">
                  {pr.id === "dating" ? "Dating-Agent" : pr.id === "moments" ? "Freunde & Anlässe" : "Treatments on demand"}
                </span>
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
      <div className="ml-auto">
        <QuickAddContact />
      </div>
      <button
        onClick={logout}
        className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-white"
      >
        Logout
      </button>
    </nav>
  )
}
