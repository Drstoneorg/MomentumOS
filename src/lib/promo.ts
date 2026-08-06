/**
 * Promo-Checkliste je Event: Standard-Fahrplan relativ zum Event-Datum.
 * Negative Tage = vor dem Event, positive = danach. Uhrzeit 10:00 UTC,
 * damit die Aufgabe im Kalender-Feed vormittags auftaucht.
 */

export const PROMO_VORLAGE: { tage: number; titel: string }[] = [
  { tage: -42, titel: "Ankündigungs-Post + Event listen (Shrine/RA)" },
  { tage: -28, titel: "Ticket-Link live + Link in Bio" },
  { tage: -21, titel: "Lineup-Announcement, Artists taggen" },
  { tage: -14, titel: "Reminder-Post + Einladungswelle prüfen" },
  { tage: -7, titel: "Story-Countdown + persönliche Nachfass-Nachrichten" },
  { tage: -2, titel: "Letzte Infos: Einlass, Specials, Anfahrt" },
  { tage: 1, titel: "Danke-Post + Fotos + Nachbereitung (wer war da)" },
]

/**
 * Aufgaben zum Event-Start. Termine in der Vergangenheit werden mitgeliefert —
 * bei einem kurzfristig angelegten Event sieht man so, was eigentlich schon
 * hätte passieren müssen.
 */
export function promoAufgaben(startsAt: string): { title: string; due_at: string }[] {
  const start = new Date(startsAt)
  if (isNaN(start.getTime())) return []
  return PROMO_VORLAGE.map(({ tage, titel }) => {
    const d = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + tage, 10, 0, 0)
    )
    return { title: titel, due_at: d.toISOString() }
  })
}
