/**
 * ICS-Datei für die Einladungs-Seite: „In Kalender eintragen" ohne Login.
 * Handgebaut statt Bibliothek — 30 Zeilen, testbar, keine Überraschungen.
 */

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}

function icsZeit(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

export type IcsEvent = {
  uid: string
  title: string
  starts_at: string
  location: string | null
  description: string | null
  /** Dauer in Stunden, Standard 4 (Party endet selten nach einer) */
  dauerStunden?: number
}

export function einladungsIcs(e: IcsEvent): string {
  const start = new Date(e.starts_at)
  if (isNaN(start.getTime())) throw new Error("Ungültiges Event-Datum")
  const ende = new Date(start.getTime() + (e.dauerStunden ?? 4) * 3600_000)

  const zeilen = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MomentumOS//Einladung//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${icsEscape(e.uid)}@momentumos`,
    `DTSTAMP:${icsZeit(new Date())}`,
    `DTSTART:${icsZeit(start)}`,
    `DTEND:${icsZeit(ende)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    ...(e.location ? [`LOCATION:${icsEscape(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${icsEscape(e.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  return zeilen.join("\r\n") + "\r\n"
}
