/**
 * Deterministische Einladungs- und Nachfass-Texte (kein KI-Aufruf: bei 30
 * Gästen wären das 30 Modellaufrufe für Textbausteine). Stilregeln der
 * Entwürfe gelten auch hier: locker, kein Punkt am Satzende, keine
 * Gedankenstriche im Nachrichtentext.
 */

export type InviteVariante = "einladung" | "nachfass"

export type InviteKontakt = { name: string; language: string | null }
export type InviteEvent = { title: string; starts_at: string | null; location: string | null }

function vorname(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

function datumsText(iso: string | null, sprache: "de" | "en"): string {
  if (!iso) return sprache === "de" ? "bald" : "soon"
  const d = new Date(iso)
  if (sprache === "de") {
    const tag = d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" })
    const zeit = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    return `${tag} um ${zeit}`
  }
  const tag = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
  const zeit = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  return `${tag} at ${zeit}`
}

export function buildInviteMessage(
  kontakt: InviteKontakt,
  event: InviteEvent,
  variante: InviteVariante,
  rsvpUrl: string
): string {
  const sprache: "de" | "en" = kontakt.language === "en" ? "en" : "de"
  const name = vorname(kontakt.name)
  const datum = datumsText(event.starts_at, sprache)
  const ort = event.location ? (sprache === "de" ? `, ${event.location}` : `, ${event.location}`) : ""

  if (sprache === "en") {
    if (variante === "nachfass") {
      return `Hey ${name}, quick reminder about ${event.title} on ${datum} 🖤 would be great if you tap yes or no here: ${rsvpUrl}`
    }
    return `Hey ${name}! I'm hosting ${event.title} on ${datum}${ort} and would love to have you there 🖤 one tap to let me know: ${rsvpUrl}`
  }
  if (variante === "nachfass") {
    return `Hey ${name}, kleiner Reminder wegen ${event.title} am ${datum} 🖤 sag mir hier kurz zu oder ab: ${rsvpUrl}`
  }
  return `Hey ${name}! Ich mache am ${datum} ${event.title}${ort} und hätte dich gern dabei 🖤 ein Tipper reicht: ${rsvpUrl}`
}
