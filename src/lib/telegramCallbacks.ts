/**
 * Callback-Daten der Telegram-Inline-Buttons (max 64 Bytes laut Bot-API):
 *   fu:<followupId>        → Follow-up erledigt
 *   sn:<signalKey>:<tage>  → Signal snoozen
 *   ap:<suggestionId>      → Queue-Entwurf freigeben (Worker sendet)
 *   sh:<suggestionId>      → Entwurfstext anzeigen
 */
export type TelegramCallback =
  | { kind: "fu"; id: string }
  | { kind: "sn"; id: string; days: number }
  | { kind: "ap"; id: string }
  | { kind: "sh"; id: string }

export function parseCallback(data: string | undefined | null): TelegramCallback | null {
  if (!data || data.length > 64) return null
  if (data.startsWith("fu:")) {
    const id = data.slice(3)
    return id ? { kind: "fu", id } : null
  }
  if (data.startsWith("sn:")) {
    const rest = data.slice(3)
    const sep = rest.lastIndexOf(":")
    if (sep <= 0) return null
    const id = rest.slice(0, sep)
    const days = Number(rest.slice(sep + 1))
    return id && Number.isFinite(days) && days > 0 && days <= 30 ? { kind: "sn", id, days } : null
  }
  if (data.startsWith("ap:")) {
    const id = data.slice(3)
    return id ? { kind: "ap", id } : null
  }
  if (data.startsWith("sh:")) {
    const id = data.slice(3)
    return id ? { kind: "sh", id } : null
  }
  return null
}
