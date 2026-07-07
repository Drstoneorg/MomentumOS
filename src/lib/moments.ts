import type { Tables } from "@/lib/database.types"

/** Tage bis zum nächsten Geburtstag (0 = heute), null wenn kein Geburtstag. */
export function daysUntilBirthday(birthday: string | null, from = new Date()): number | null {
  if (!birthday) return null
  const b = new Date(birthday)
  if (isNaN(b.getTime())) return null
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  if (next < today) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate())
  return Math.round((next.getTime() - today.getTime()) / 86400_000)
}

export function turningAge(birthday: string | null, from = new Date()): number | null {
  if (!birthday) return null
  const b = new Date(birthday)
  if (isNaN(b.getTime())) return null
  const d = daysUntilBirthday(birthday, from) ?? 0
  const year = d === 0 ? from.getFullYear() : from.getFullYear() + (new Date(from.getFullYear(), b.getMonth(), b.getDate()) < from ? 1 : 0)
  return year - b.getFullYear()
}

/**
 * Verbindungs-Score: 0 (frisch) bis 100 (dringend melden).
 * Basiert auf Tagen seit letztem Kontakt relativ zum Frequenzziel.
 */
export function connectionScore(contact: Pick<Tables<"contacts">, "last_contact_at" | "contact_frequency_days">): {
  score: number
  daysSince: number | null
  overdue: boolean
} {
  if (!contact.last_contact_at) return { score: 60, daysSince: null, overdue: true }
  const daysSince = Math.floor(
    (Date.now() - new Date(contact.last_contact_at).getTime()) / 86400_000
  )
  const target = contact.contact_frequency_days ?? 42 // Default 6 Wochen
  const score = Math.max(0, Math.min(100, Math.round((daysSince / target) * 70)))
  return { score, daysSince, overdue: daysSince >= target }
}

export function scoreColor(score: number): string {
  if (score >= 80) return "bg-rose-500"
  if (score >= 50) return "bg-amber-500"
  return "bg-emerald-500"
}
