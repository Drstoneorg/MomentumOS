/**
 * Fehler-Telemetrie auswerten: gleiche Fehler trotz variabler Details (IDs,
 * URLs, Zahlen, Zeilennummern) zu einer Gruppe zusammenfassen. Erst die
 * Häufung macht aus einer Zeile in client_errors ein handelbares Signal.
 */

export type FehlerZeile = { message: string; created_at: string }
export type FehlerGruppe = { muster: string; anzahl: number; zuletzt: string }

/** Variable Teile durch Platzhalter ersetzen, damit gleiche Fehler gleich aussehen. */
export function normalisiereFehlermeldung(message: string): string {
  return message
    .replace(/https?:\/\/[^\s"')]+/g, "‹url›")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "‹id›")
    .replace(/\b[0-9a-f]{16,}\b/gi, "‹hex›")
    .replace(/\d+/g, "‹n›")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160)
}

/** Nach normalisierter Meldung gruppieren, häufigste zuerst; zuletzt = jüngster Zeitstempel. */
export function gruppiereFehler(zeilen: FehlerZeile[]): FehlerGruppe[] {
  const gruppen = new Map<string, FehlerGruppe>()
  for (const z of zeilen) {
    const muster = normalisiereFehlermeldung(z.message)
    if (!muster) continue
    const g = gruppen.get(muster)
    if (!g) {
      gruppen.set(muster, { muster, anzahl: 1, zuletzt: z.created_at })
    } else {
      g.anzahl++
      if (z.created_at > g.zuletzt) g.zuletzt = z.created_at
    }
  }
  return [...gruppen.values()].sort((a, b) => b.anzahl - a.anzahl || (a.zuletzt < b.zuletzt ? 1 : -1))
}
