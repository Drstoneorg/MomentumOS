"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/contacts", label: "Matchbox" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/queue", label: "Queue" },
  { href: "/settings", label: "Einstellungen" },
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await createClient().auth.signOut()
    router.push("/login")
    router.refresh()
  }

  if (pathname.startsWith("/login")) return null

  return (
    <nav className="sticky top-0 z-10 flex items-center gap-1 border-b border-zinc-800 bg-zinc-950/90 px-4 py-2 backdrop-blur">
      <span className="mr-4 font-bold text-rose-500">MatchOS</span>
      {links.map((l) => (
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
      <button
        onClick={logout}
        className="ml-auto rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-white"
      >
        Logout
      </button>
    </nav>
  )
}
