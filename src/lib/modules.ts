/**
 * Zentrale Modul-Registry: eine Quelle für Farben, Links und Beschreibungen
 * aller fünf Module. Nav, Dashboard, Inbox und Command-Palette lesen hieraus —
 * neue Module oder Farbwechsel passieren nur noch an dieser Stelle.
 */
export type ModuleId = "match" | "moments" | "jobs" | "book" | "trading"
export type SignalModule = ModuleId | "system"

export type ModuleDef = {
  id: ModuleId
  label: string
  tagline: string
  home: string
  /** Tailwind-Klassen — bewusst Literale, damit der Scanner sie findet. */
  text: string
  bg: string
  border: string
  dot: string
  /** Hex für SVG-Sparklines (CSS-Variablen ziehen in SVG-Attributen nicht überall). */
  hex: string
  match: (path: string) => boolean
  links: { href: string; label: string }[]
}

export const MODULES: ModuleDef[] = [
  {
    id: "match",
    label: "MatchOS",
    tagline: "Dating-Agent",
    home: "/",
    text: "text-rose-500",
    bg: "bg-rose-950/40",
    border: "border-rose-800/60",
    dot: "bg-rose-500",
    hex: "#f43f5e",
    match: (p) =>
      p === "/" ||
      p.startsWith("/inbox") ||
      p.startsWith("/contacts") ||
      p.startsWith("/pipeline") ||
      p.startsWith("/queue") ||
      p.startsWith("/settings"),
    links: [
      { href: "/", label: "Dashboard" },
      { href: "/contacts", label: "Matchbox" },
      { href: "/pipeline", label: "Pipeline" },
      { href: "/queue", label: "Queue" },
      { href: "/settings", label: "Einstellungen" },
    ],
  },
  {
    id: "moments",
    label: "MomentOS",
    tagline: "Freunde, Karten & Anlässe",
    home: "/moments",
    text: "text-amber-400",
    bg: "bg-amber-950/40",
    border: "border-amber-800/60",
    dot: "bg-amber-400",
    hex: "#fbbf24",
    match: (p) => p.startsWith("/moments") || p.startsWith("/cards") || p.startsWith("/capture"),
    links: [
      { href: "/moments", label: "Hub" },
      { href: "/cards", label: "🃏 Karten" },
      { href: "/capture", label: "📸 Erfassen" },
      { href: "/moments/people", label: "Kontakte" },
      { href: "/moments/events", label: "Events" },
      { href: "/moments/meetups", label: "Meetups" },
    ],
  },
  {
    id: "jobs",
    label: "JobOS",
    tagline: "Bewerbungs-Manager",
    home: "/jobs",
    text: "text-emerald-400",
    bg: "bg-emerald-950/40",
    border: "border-emerald-800/60",
    dot: "bg-emerald-400",
    hex: "#34d399",
    match: (p) => p.startsWith("/jobs"),
    links: [
      { href: "/jobs", label: "Bewerbungen" },
      { href: "/jobs/cv", label: "CV-Profil" },
    ],
  },
  {
    id: "book",
    label: "BookOS",
    tagline: "Treatments & Artists",
    home: "/book",
    text: "text-sky-400",
    bg: "bg-sky-950/40",
    border: "border-sky-800/60",
    dot: "bg-sky-400",
    hex: "#38bdf8",
    match: (p) => p.startsWith("/book") || p.startsWith("/provider"),
    links: [
      { href: "/book", label: "Treatment buchen" },
      { href: "/book/bookings", label: "Meine Buchungen" },
      { href: "/book/artists", label: "🎧 Artists" },
      { href: "/provider", label: "Anbieter" },
    ],
  },
  {
    id: "trading",
    label: "TradingOS",
    tagline: "Paper-Trading-Labor",
    home: "/trading",
    text: "text-violet-400",
    bg: "bg-violet-950/40",
    border: "border-violet-800/60",
    dot: "bg-violet-400",
    hex: "#a78bfa",
    match: (p) => p.startsWith("/trading"),
    links: [{ href: "/trading", label: "Paper-Portfolio" }],
  },
]

export const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id, m]))

/** Anzeige-Infos für System-Signale (Cron/Scraper-Warnungen) neben den Modulen. */
export const SYSTEM_STYLE = {
  label: "System",
  text: "text-amber-300",
  bg: "bg-amber-950/40",
  border: "border-amber-800/60",
  dot: "bg-amber-300",
  hex: "#fcd34d",
}

export function moduleStyle(id: SignalModule) {
  if (id === "system") return SYSTEM_STYLE
  const m = MODULE_BY_ID.get(id)!
  return { label: m.label, text: m.text, bg: m.bg, border: m.border, dot: m.dot, hex: m.hex }
}
