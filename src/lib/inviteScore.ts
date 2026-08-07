import { audienceMatch } from "@/lib/artists"

/**
 * Gäste-Ranking für den Einladungs-Assistenten: wer passt zu diesem Event.
 * Bewusst deterministisch und erklärbar — jeder Punkt hat einen Grund-Chip,
 * damit die Sortierung nie wie Orakel wirkt.
 */

export type GastKandidat = {
  realm: string
  intent: string | null
  location: string | null
  relationship_tags: string[] | null
  interests: string[] | null
}

export type EinladungsHistorie = {
  /** bisherige Einladungen (alle Events) */
  eingeladen: number
  /** davon mit irgendeiner Reaktion: Zusage, Absage, Ticket, da gewesen */
  reagiert: number
}

export type GastScore = { score: number; gruende: string[] }

/** Ermüdungsschutz: ab so vielen reaktionslosen Einladungen wird abgestuft. */
export const ERMUEDUNG_AB = 2

export function gastScore(
  kontakt: GastKandidat,
  event: { audience: string | null; location: string | null },
  historie: EinladungsHistorie
): GastScore {
  let score = 0
  const gruende: string[] = []

  // Stil-Passung: Zielpublikum des Events gegen Tags + Interessen der Person
  const eigenesProfil = [...(kontakt.relationship_tags ?? []), ...(kontakt.interests ?? [])].join(" ")
  const match = audienceMatch(event.audience, eigenesProfil)
  if (match && match.score > 0) {
    score += Math.round(match.score / 2)
    gruende.push(`Stil ${match.score}%`)
  }

  if (kontakt.realm === "moment") {
    score += 25
    gruende.push("Freundeskreis")
  } else if (kontakt.intent === "event_lead" || kontakt.intent === "both") {
    score += 20
    gruende.push("Event-Lead")
  }

  // Gleiche Stadt (grober Wortvergleich reicht: "Wien" in "1050 Wien")
  const eventOrt = (event.location ?? "").toLowerCase()
  const kontaktOrt = (kontakt.location ?? "").toLowerCase()
  if (eventOrt && kontaktOrt && (eventOrt.includes(kontaktOrt) || kontaktOrt.split(/[\s,]+/).some((w) => w.length > 2 && eventOrt.includes(w)))) {
    score += 15
    gruende.push("gleiche Stadt")
  }

  if (historie.eingeladen >= ERMUEDUNG_AB && historie.reagiert === 0) {
    score -= 40
    gruende.push(`${historie.eingeladen}× nie reagiert`)
  } else if (historie.eingeladen >= 2 && historie.reagiert / historie.eingeladen >= 0.7) {
    score += 10
    gruende.push("reagiert zuverlässig")
  }

  return { score, gruende }
}

/**
 * Zusagen-Zählung inklusive Begleitungen — die Zahl, die gegen Ziel und
 * Kapazität läuft.
 */
export function zusagenMitBegleitung(
  invites: { status: string; plus_ones: number | null }[]
): { zusagen: number; begleitungen: number; gesamt: number } {
  let zusagen = 0
  let begleitungen = 0
  for (const i of invites) {
    if (["yes", "ticket", "attended"].includes(i.status)) {
      zusagen++
      begleitungen += Math.max(0, i.plus_ones ?? 0)
    }
  }
  return { zusagen, begleitungen, gesamt: zusagen + begleitungen }
}
