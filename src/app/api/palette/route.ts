import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { Command } from "@/lib/palette"

/**
 * Live-Suche für die Command-Palette: Kontakte, Jobs, Artists, Events.
 * Bewusst klein gehalten (Name/Titel reicht) — Volltreffer gibt es unter /search.
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) return NextResponse.json({ items: [] })
  const like = `%${q.replace(/[,()%]/g, " ").trim()}%`

  const [contactsRes, jobsRes, artistsRes, eventsRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, realm, platform")
      .ilike("name", like)
      .neq("pipeline_stage", "archived")
      .limit(6),
    supabase
      .from("job_applications")
      .select("id, company, title")
      .or(`company.ilike.${like},title.ilike.${like}`)
      .limit(4),
    supabase.from("artists").select("id, name, artist_type").ilike("name", like).limit(4),
    supabase.from("events").select("id, title").ilike("title", like).limit(3),
  ])

  const items: Command[] = [
    ...(contactsRes.data ?? []).map((c) => ({
      label: c.name,
      sub: c.realm === "moment" ? "Freund·in" : c.platform ?? "Match",
      href: `/contacts/${c.id}`,
      module: (c.realm === "moment" ? "moments" : "match") as Command["module"],
      icon: "👤",
    })),
    ...(jobsRes.data ?? []).map((j) => ({
      label: `${j.title} · ${j.company}`,
      href: "/jobs",
      module: "jobs" as const,
      icon: "💼",
    })),
    ...(artistsRes.data ?? []).map((a) => ({
      label: a.name,
      sub: a.artist_type ?? undefined,
      href: `/book/artists/${a.id}`,
      module: "book" as const,
      icon: "🎧",
    })),
    ...(eventsRes.data ?? []).map((e) => ({
      label: e.title,
      href: `/moments/events/${e.id}`,
      module: "moments" as const,
      icon: "🎟",
    })),
  ]

  return NextResponse.json({ items })
}
