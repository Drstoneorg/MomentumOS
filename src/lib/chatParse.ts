/**
 * Deterministischer Parser für Chat-Blöcke aus Extension/Import.
 * Ersetzt das LLM fürs Nachrichten-Splitting: [me]/[them]-Präfixe sind eindeutig,
 * Regex ist billiger, schneller und flippt nie die Richtung. Das LLM bekommt nur
 * noch den Profilteil. Zeitstempel-Zeilen (09:53 / 10.07.2026, 13:33) werden als
 * echte sent_at übernommen statt geschätzt.
 */

export type ParsedChatMessage = {
  direction: "in" | "out"
  content: string
  at: string | null // ISO-Zeitstempel, wenn im Text erkennbar
}

const CHAT_MARKER = /---\s*CHATVERLAUF\s*---/i
const PREFIX_RE = /^\[(me|them)\]\s?(.*)$/
// "09:53", "10.07.2026, 13:33", "10.07.26 13:33:05" — als komplette Zeile
const TIME_LINE_RE =
  /^(?:(\d{1,2})\.(\d{1,2})\.(\d{2,4})[,\s]+)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/

/** Trennt Rohtext in Profilteil und Chatblock (null wenn kein Block markiert ist). */
export function splitChatBlock(raw: string): { profile: string; chat: string | null } {
  const parts = raw.split(CHAT_MARKER)
  if (parts.length < 2) return { profile: raw, chat: null }
  return { profile: parts[0].trim(), chat: parts.slice(1).join("\n").trim() || null }
}

function parseTime(match: RegExpMatchArray, reference: Date): string | null {
  const [, d, mo, y, h, mi, s] = match
  const date = new Date(reference)
  if (d && mo && y) {
    const year = y.length === 2 ? 2000 + Number(y) : Number(y)
    date.setFullYear(year, Number(mo) - 1, Number(d))
  }
  date.setHours(Number(h), Number(mi), s ? Number(s) : 0, 0)
  if (isNaN(date.getTime())) return null
  // Nur-Uhrzeit, die in der Zukunft läge: war gestern
  if (!d && date.getTime() > reference.getTime() + 5 * 60_000) {
    date.setDate(date.getDate() - 1)
  }
  return date.toISOString()
}

/**
 * Parst [me]/[them]-Zeilen zu Nachrichten. Zeilen ohne Präfix werden an die
 * laufende Nachricht angehängt; reine Zeitstempel-Zeilen setzen sent_at der
 * aktuellen (bzw. nächsten) Nachricht. Leeres Ergebnis = Format unbekannt,
 * Aufrufer fällt aufs LLM zurück.
 */
export function parseChatLines(chat: string, reference = new Date()): ParsedChatMessage[] {
  const messages: ParsedChatMessage[] = []
  let current: ParsedChatMessage | null = null
  let pendingTime: string | null = null

  for (const rawLine of chat.split("\n")) {
    const line = rawLine.trim()
    if (!line) continue

    const timeMatch = line.match(TIME_LINE_RE)
    if (timeMatch) {
      const iso = parseTime(timeMatch, reference)
      if (current && !current.at) current.at = iso
      else pendingTime = iso
      continue
    }

    const prefixMatch = line.match(PREFIX_RE)
    if (prefixMatch) {
      current = {
        direction: prefixMatch[1] === "me" ? "out" : "in",
        content: prefixMatch[2].trim(),
        at: pendingTime,
      }
      pendingTime = null
      messages.push(current)
      continue
    }

    // Fortsetzungszeile einer mehrzeiligen Nachricht
    if (current) current.content = `${current.content}\n${line}`.trim()
  }

  return messages.filter((m) => m.content.length > 0)
}
