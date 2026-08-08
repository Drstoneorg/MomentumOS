import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

/**
 * Deterministische Einladungs- und Nachfass-Texte (kein KI-Aufruf: bei 30
 * Gästen wären das 30 Modellaufrufe für Textbausteine). Stilregeln der
 * Entwürfe gelten auch hier: locker, kein Punkt am Satzende, keine
 * Gedankenstriche im Nachrichtentext.
 *
 * Seit R31 kommen die Texte aus der templates-Tabelle (Editor unter /vorlagen)
 * mit Variante A/B je Schlüssel — die Konstanten hier sind Startbestand und
 * Fallback, wenn die DB (noch) nichts hat.
 */

export type InviteVariante = "einladung" | "nachfass"

export type InviteKontakt = { name: string; language: string | null }
export type InviteEvent = { title: string; starts_at: string | null; location: string | null }

export type Vorlage = { key: string; lang: "de" | "en"; variant: string; text: string }

/** Platzhalter, die der Editor dokumentiert und fuelleVorlage ersetzt. */
export const VORLAGEN_PLATZHALTER = ["{name}", "{event}", "{datum}", "{ort}", "{link}"] as const

export const STANDARD_VORLAGEN: Vorlage[] = [
  {
    key: "einladung",
    lang: "de",
    variant: "A",
    text: "Hey {name}! Ich mache am {datum} {event}{ort} und hätte dich gern dabei 🖤 ein Tipper reicht: {link}",
  },
  {
    key: "einladung",
    lang: "en",
    variant: "A",
    text: "Hey {name}! I'm hosting {event} on {datum}{ort} and would love to have you there 🖤 one tap to let me know: {link}",
  },
  {
    key: "nachfass",
    lang: "de",
    variant: "A",
    text: "Hey {name}, kleiner Reminder wegen {event} am {datum} 🖤 sag mir hier kurz zu oder ab: {link}",
  },
  {
    key: "nachfass",
    lang: "en",
    variant: "A",
    text: "Hey {name}, quick reminder about {event} on {datum} 🖤 would be great if you tap yes or no here: {link}",
  },
]

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

/** Platzhalter ersetzen — unbekannte bleiben stehen (fällt im Editor sofort auf). */
export function fuelleVorlage(
  text: string,
  werte: { name: string; event: string; datum: string; ort: string; link: string }
): string {
  return text
    .replaceAll("{name}", werte.name)
    .replaceAll("{event}", werte.event)
    .replaceAll("{datum}", werte.datum)
    .replaceAll("{ort}", werte.ort)
    .replaceAll("{link}", werte.link)
}

/**
 * Aktive Vorlagen aus der DB, gruppiert nach key:lang, Varianten sortiert
 * (A vor B). Fällt komplett oder je Schlüssel auf STANDARD_VORLAGEN zurück.
 */
export async function ladeVorlagen(
  supabase: SupabaseClient<Database>
): Promise<Map<string, Vorlage[]>> {
  const map = new Map<string, Vorlage[]>()
  try {
    const { data } = await supabase
      .from("templates")
      .select("key, lang, variant, text")
      .eq("active", true)
      .order("variant")
    for (const t of data ?? []) {
      if (!t.text.trim()) continue
      const k = `${t.key}:${t.lang}`
      const arr = map.get(k) ?? []
      arr.push({ key: t.key, lang: t.lang === "en" ? "en" : "de", variant: t.variant, text: t.text })
      map.set(k, arr)
    }
  } catch {
    // DB nicht erreichbar: Standard reicht
  }
  for (const s of STANDARD_VORLAGEN) {
    const k = `${s.key}:${s.lang}`
    if (!map.has(k)) map.set(k, [s])
  }
  return map
}

/**
 * Vorlage wählen: gibt es A und B, wechseln sich die Varianten über den Index
 * ab (A/B-Test — die Antwortquote je Variante steht im Editor).
 */
export function waehleVorlage(
  vorlagen: Map<string, Vorlage[]>,
  key: InviteVariante,
  lang: "de" | "en",
  index: number
): Vorlage {
  const liste = vorlagen.get(`${key}:${lang}`) ?? []
  if (liste.length === 0) {
    const std = STANDARD_VORLAGEN.find((s) => s.key === key && s.lang === lang)!
    return std
  }
  return liste[index % liste.length]
}

/** Text für einen Gast aus einer konkreten Vorlage bauen. */
export function buildInviteFromVorlage(
  vorlage: Vorlage,
  kontakt: InviteKontakt,
  event: InviteEvent,
  rsvpUrl: string
): string {
  const sprache = vorlage.lang
  return fuelleVorlage(vorlage.text, {
    name: vorname(kontakt.name),
    event: event.title,
    datum: datumsText(event.starts_at, sprache),
    ort: event.location ? `, ${event.location}` : "",
    link: rsvpUrl,
  })
}

/** Bequemer Alt-Weg ohne DB (Tests, Fallback): Standard-Variante A. */
export function buildInviteMessage(
  kontakt: InviteKontakt,
  event: InviteEvent,
  variante: InviteVariante,
  rsvpUrl: string
): string {
  const sprache: "de" | "en" = kontakt.language === "en" ? "en" : "de"
  const std = STANDARD_VORLAGEN.find((s) => s.key === variante && s.lang === sprache)!
  return buildInviteFromVorlage(std, kontakt, event, rsvpUrl)
}
