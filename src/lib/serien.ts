/**
 * Serien-Events: mehrere Ausgaben unter events.series_name verknüpft.
 * Statistik über die Reihe — Wachstum, Wiederkehrer-Quote, stärkste Ausgabe.
 */

export type SerienAusgabe = {
  id: string
  title: string
  starts_at: string | null
  invites: { contact_id: string; status: string; plus_ones: number | null }[]
}

export type SerienStatistik = {
  ausgaben: { id: string; title: string; starts_at: string | null; zusagen: number; da: number }[]
  /** Anteil der Gäste, die bei mindestens zwei Ausgaben da waren (0..1), null unter 2 Ausgaben mit Gästen */
  wiederkehrerQuote: number | null
  /** attended-Differenz letzte vs. vorletzte Ausgabe, null wenn nicht vergleichbar */
  trend: number | null
}

export function serienStatistik(events: SerienAusgabe[]): SerienStatistik {
  const sortiert = [...events].sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""))

  const ausgaben = sortiert.map((e) => {
    let zusagen = 0
    let da = 0
    for (const i of e.invites) {
      if (["yes", "ticket", "attended"].includes(i.status)) zusagen += 1 + Math.max(0, i.plus_ones ?? 0)
      if (i.status === "attended") da += 1 + Math.max(0, i.plus_ones ?? 0)
    }
    return { id: e.id, title: e.title, starts_at: e.starts_at, zusagen, da }
  })

  // Wiederkehrer: pro Kontakt zählen, bei wie vielen Ausgaben er da war
  const besuche = new Map<string, number>()
  for (const e of sortiert) {
    const daIds = new Set(e.invites.filter((i) => i.status === "attended").map((i) => i.contact_id))
    for (const id of daIds) besuche.set(id, (besuche.get(id) ?? 0) + 1)
  }
  const gaeste = besuche.size
  const wiederkehrer = [...besuche.values()].filter((n) => n >= 2).length
  const mitGaesten = ausgaben.filter((a) => a.da > 0).length
  const wiederkehrerQuote = mitGaesten >= 2 && gaeste > 0 ? wiederkehrer / gaeste : null

  const vergangene = ausgaben.filter((a) => a.starts_at && new Date(a.starts_at).getTime() < Date.now())
  const trend =
    vergangene.length >= 2
      ? vergangene[vergangene.length - 1].da - vergangene[vergangene.length - 2].da
      : null

  return { ausgaben, wiederkehrerQuote, trend }
}
