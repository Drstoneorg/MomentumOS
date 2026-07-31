import { MODULES, type SignalModule } from "@/lib/modules"

/**
 * Command-Palette (⌘K): Fuzzy-Matching + statischer Kommando-Katalog.
 * Live-Treffer (Kontakte, Jobs, Artists, Events) kommen aus /api/palette.
 */
export type Command = {
  label: string
  sub?: string
  href: string
  module: SignalModule | null
  icon: string
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")

/**
 * Subsequenz-Fuzzy-Score: 0 = kein Treffer, höher = besser.
 * Bonus für Substring, Wortanfänge und zusammenhängende Zeichen.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = normalize(query.trim())
  const t = normalize(text)
  if (!q) return 1
  if (t.includes(q)) return 100 - t.indexOf(q) - (t.length - q.length) * 0.1
  let score = 0
  let ti = 0
  let lastHit = -2
  for (const ch of q) {
    let found = -1
    for (let i = ti; i < t.length; i++) {
      if (t[i] === ch) {
        found = i
        break
      }
    }
    if (found === -1) return 0
    const wordStart = found === 0 || t[found - 1] === " " || t[found - 1] === "/"
    score += wordStart ? 3 : found === lastHit + 1 ? 2 : 1
    lastHit = found
    ti = found + 1
  }
  return score
}

export function staticCommands(): Command[] {
  const cmds: Command[] = [
    { label: "Inbox — alle Signale", href: "/inbox", module: null, icon: "📥" },
    { label: "Fokus-Modus starten", href: "/focus", module: null, icon: "▶" },
    { label: "Fragen — Freitext über alle Daten", href: "/ask", module: null, icon: "🔮" },
    { label: "Schnell erfassen (Screenshot/Text)", href: "/capture", module: "moments", icon: "📸" },
    { label: "Karte erstellen", href: "/cards", module: "moments", icon: "🃏" },
    { label: "Lebenslauf ansehen", href: "/jobs/cv", module: "jobs", icon: "📄" },
    { label: "Einstellungen", href: "/settings", module: null, icon: "⚙️" },
  ]
  for (const m of MODULES) {
    for (const l of m.links) {
      cmds.push({
        label: `${m.label} · ${l.label.replace(/^[^\p{L}\d]+\s*/u, "")}`,
        href: l.href,
        module: m.id,
        icon: "→",
      })
    }
  }
  // Doppelte Ziele raus (z. B. Einstellungen ist auch MatchOS-Link)
  const seen = new Set<string>()
  return cmds.filter((c) => (seen.has(c.href + c.label) ? false : (seen.add(c.href + c.label), true)))
}

export function filterCommands(query: string, commands: Command[], limit = 8): Command[] {
  if (!query.trim()) return commands.slice(0, limit)
  return commands
    .map((c) => ({ c, s: fuzzyScore(query, c.label) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.c)
}
