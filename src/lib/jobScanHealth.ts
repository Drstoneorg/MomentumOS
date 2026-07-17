export type ScanRun = { portal: string; found: number; ran_at: string }

export type ScanWarning = { portal: string; zeroRuns: number; lastAt: string }

/**
 * Scraper-Gesundheit: Portale, deren letzte `minRuns` Läufe allesamt 0 Treffer
 * hatten — Kandidat für stillen Scraper-Tod (DOM-Umbau, Bot-Block).
 * Weniger als `minRuns` Läufe insgesamt → keine Aussage, keine Warnung.
 */
export function scanWarnings(runs: ScanRun[], minRuns = 3): ScanWarning[] {
  const byPortal = new Map<string, ScanRun[]>()
  for (const r of runs) {
    const list = byPortal.get(r.portal) ?? []
    list.push(r)
    byPortal.set(r.portal, list)
  }
  const out: ScanWarning[] = []
  for (const [portal, list] of byPortal) {
    const recent = [...list]
      .sort((a, b) => b.ran_at.localeCompare(a.ran_at))
      .slice(0, minRuns)
    if (recent.length < minRuns) continue
    if (recent.every((r) => r.found === 0)) {
      out.push({ portal, zeroRuns: recent.length, lastAt: recent[0].ran_at })
    }
  }
  return out.sort((a, b) => a.portal.localeCompare(b.portal))
}
