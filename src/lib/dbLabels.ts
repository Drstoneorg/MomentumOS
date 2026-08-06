import type { Enums } from "./database.types"

/**
 * Labels und Reihenfolgen zu DB-Enums. Lebten früher als Handzusatz unten in
 * database.types.ts — seit die Datei komplett generiert wird (npm run types:gen),
 * würde ein Regenerieren sie dort überschreiben. Deshalb hier.
 */

export const PIPELINE_STAGES: Enums<"pipeline_stage">[] = [
  "new_match",
  "first_message_pending",
  "chatting",
  "interest_visible",
  "platform_switch",
  "on_messenger",
  "date_idea",
  "date_proposed",
  "scheduling",
  "date_planned",
  "calendar_created",
  "archived",
]

export const STAGE_LABELS: Record<Enums<"pipeline_stage">, string> = {
  new_match: "Neues Match",
  first_message_pending: "Erste Nachricht offen",
  chatting: "Gespräch läuft",
  interest_visible: "Interesse erkennbar",
  platform_switch: "Plattformwechsel",
  on_messenger: "Auf Messenger",
  date_idea: "Date-Idee möglich",
  date_proposed: "Date vorgeschlagen",
  scheduling: "Termin-Abstimmung",
  date_planned: "Date geplant",
  calendar_created: "Kalender erstellt",
  archived: "Archiviert",
}

export const MEETUP_STATUS_LABELS: Record<Enums<"meetup_status">, string> = {
  idea: "Idee",
  proposed: "Vorgeschlagen",
  confirmed: "Bestätigt",
  happened: "Stattgefunden",
  cancelled: "Abgesagt",
}

export const RSVP_LABELS: Record<Enums<"event_invite_status">, string> = {
  invited: "Eingeladen",
  yes: "Zugesagt",
  no: "Abgesagt",
  no_reply: "Keine Antwort",
  ticket: "🎟 Ticket gekauft",
  attended: "✔ War da",
}

// Kontakt-Intent: wozu pflege ich diesen Kontakt (nur MatchOS-Realm relevant)
export const INTENT_LABELS: Record<string, string> = {
  date: "💘 Date",
  event_lead: "🎟 Event-Lead",
  both: "💘🎟 Beides",
}

export const BOOKING_STATUS_LABELS: Record<Enums<"booking_status">, string> = {
  requested: "Angefragt",
  accepted: "Angenommen",
  en_route: "Auf dem Weg",
  arrived: "Angekommen",
  in_progress: "Läuft",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
}

// Reihenfolge der aktiven Status für Fortschrittsanzeige
export const BOOKING_FLOW: Enums<"booking_status">[] = [
  "requested",
  "accepted",
  "en_route",
  "arrived",
  "in_progress",
  "completed",
]
