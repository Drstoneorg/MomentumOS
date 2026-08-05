/**
 * RecruitOS: Model-Scouting mit TFP-Shootings (Time for Print — Shooting gegen
 * beidseitige Nutzungsrechte). Kontakte leben im Realm "recruit" mit eigener
 * Pipeline-Stufe. Grundregeln des Moduls: kein Scraping, kein Auto-Versand —
 * Erfassung nur einzeln durch den Nutzer oder per Einwilligung übers
 * Bewerbungsformular; jede Nachricht wird von Hand gesendet.
 */

export const RECRUIT_STAGES = [
  "scouted",
  "contacted",
  "interested",
  "shoot_planned",
  "shoot_done",
  "delivered",
  "published",
  "declined",
] as const

export type RecruitStage = (typeof RECRUIT_STAGES)[number]

export const RECRUIT_STAGE_LABELS: Record<RecruitStage, string> = {
  scouted: "Entdeckt",
  contacted: "Angeschrieben",
  interested: "Interessiert",
  shoot_planned: "Shooting geplant",
  shoot_done: "Shooting done",
  delivered: "Edits geliefert",
  published: "Referenz",
  declined: "Abgesagt",
}

export function isRecruitStage(v: unknown): v is RecruitStage {
  return typeof v === "string" && (RECRUIT_STAGES as readonly string[]).includes(v)
}

/** Nächster sinnvoller Schritt je Stufe — als Hinweis auf der Karte. */
export const RECRUIT_NEXT_HINT: Partial<Record<RecruitStage, string>> = {
  scouted: "Erstnachricht entwerfen und selbst senden",
  contacted: "auf Antwort warten, nach 7 Tagen einmal nachfassen",
  interested: "Termin und Location vorschlagen",
  shoot_planned: "Vertrag + Ausweis-Check vorbereiten",
  shoot_done: "Auswahl schicken, Edits liefern",
  delivered: "nach 2-4 Wochen um Verlinkung/Referenz bitten",
}
