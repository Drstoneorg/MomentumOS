import { chatJSON } from "./deepseek"

export type MomentKind = "birthday" | "checkin" | "invite" | "meetup" | "recap"

export type MomentInput = {
  kind: MomentKind
  name: string
  relationship: string // Tags/Beziehung, z.B. "enger Freundeskreis"
  language: string
  styleProfile: string
  context: string // Interessen, letzte gemeinsame Sachen, Event-/Meetup-Details
}

export type MomentMessages = {
  variants: Record<string, string>
  note: string
}

const KIND_BRIEF: Record<MomentKind, string> = {
  birthday: "Geburtstagsgruß — herzlich, persönlich, kein Standard-Spruch.",
  checkin: "Lockeres Wieder-Melden nach längerer Kontaktpause, ohne Druck, ohne Schuldgefühl.",
  invite: "Einladung zu einem Event — klar mit Anlass, einladend, unaufdringlich.",
  meetup: "Konkreter Treffen-Vorschlag (1:1 oder klein) mit Zeit/Ort-Optionen.",
  recap: "Kurzer, warmer Jahresrückblick als Aufhänger für eine Nachricht.",
}

const STYLES = ["herzlich", "locker", "kurz", "witzig", "für Gruppenchat"]

export async function generateMomentMessages(
  input: MomentInput
): Promise<MomentMessages> {
  const system = `Du schreibst persönliche Nachrichten in MEINEM Stil:
${input.styleProfile}

Aufgabe: ${KIND_BRIEF[input.kind]}
Sprache der Nachricht: ${input.language}. Beziehung zur Person: ${input.relationship || "unbekannt"}.
Nie generisch, nie kitschig, nie wie eine Grußkarten-Floskel. Echte Chat-Nachrichten.

Antworte als JSON:
{
  "variants": { ${STYLES.map((s) => `"${s}": "..."`).join(", ")} },
  "note": "1 Satz: worauf beim Versand achten"
}`

  const user = `Person: ${input.name}
Kontext: ${input.context || "—"}`

  const raw = await chatJSON(system, user, "moment_message")
  const parsed = JSON.parse(raw) as MomentMessages
  return { variants: parsed.variants ?? {}, note: parsed.note ?? "" }
}
