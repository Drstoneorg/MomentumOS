/**
 * Sparkline-Mathematik als pure Funktionen — die SVG-Komponenten in
 * components/charts.tsx rendern nur noch, gerechnet wird hier (testbar).
 */

/** Zählt Ereignisse pro Kalendertag (UTC) über die letzten `days` Tage, älteste zuerst. */
export function dailyCounts(
  isoDates: (string | null | undefined)[],
  days: number,
  now = new Date()
): number[] {
  const counts = new Map<string, number>()
  for (const d of isoDates) {
    if (!d) continue
    const t = new Date(d)
    if (isNaN(t.getTime())) continue
    const key = t.toISOString().slice(0, 10)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const out: number[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(now.getTime() - i * 86400_000).toISOString().slice(0, 10)
    out.push(counts.get(key) ?? 0)
  }
  return out
}

/**
 * Punktliste für ein SVG-<polyline> (viewBox 0 0 w h), y invertiert.
 * Flache Serien laufen als Mittellinie, damit die Sparkline nie „leer" wirkt.
 */
export function sparklinePoints(values: number[], w = 100, h = 28, pad = 2): string {
  if (values.length === 0) return ""
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const innerH = h - pad * 2
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0
  return values
    .map((v, i) => {
      const x = pad + i * step
      const y = span === 0 ? h / 2 : pad + innerH - ((v - min) / span) * innerH
      return `${round1(x)},${round1(y)}`
    })
    .join(" ")
}

/** Letzter Punkt der Punktliste (für den Marker am Serienende). */
export function lastPoint(points: string): { x: number; y: number } | null {
  const last = points.split(" ").filter(Boolean).pop()
  if (!last) return null
  const [x, y] = last.split(",").map(Number)
  return isNaN(x) || isNaN(y) ? null : { x, y }
}

const round1 = (n: number) => Math.round(n * 10) / 10
