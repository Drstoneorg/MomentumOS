import { Card } from "@/components/ui"
import { scaledPoints, lastPoint } from "@/lib/charts"

/**
 * Equity-Kurve: KI-Depot vs. stumpfer ETF-Sparplan, absolute EUR-Werte —
 * fairer Vergleich, weil beide Seiten täglich dieselben 15€ bekommen.
 * Farben CVD-geprüft (violet-500 / amber-600 auf zinc-900), Serien zusätzlich
 * direkt beschriftet — Identität hängt nie an der Farbe allein.
 */

const KI_FARBE = "#8b5cf6"
const BENCH_FARBE = "#d97706"
const W = 560
const H = 160
const PAD = 6

type Snapshot = {
  day: string
  ki_value_eur: number
  bench_value_eur: number
}

const eur = (n: number) =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })

export function EquityChart({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length < 2) {
    return (
      <Card title="📉 Equity-Kurve">
        <p className="text-sm text-zinc-500">
          Noch zu wenig Historie — die Kurve wächst mit jedem Handelstag (ein Punkt pro Tag,
          geschrieben vom Tageslauf).
        </p>
      </Card>
    )
  }

  const ki = snapshots.map((s) => Number(s.ki_value_eur))
  const bench = snapshots.map((s) => Number(s.bench_value_eur))
  const alle = [...ki, ...bench]
  const min = Math.min(...alle)
  const max = Math.max(...alle)

  const kiPts = scaledPoints(ki, min, max, W, H, PAD)
  const benchPts = scaledPoints(bench, min, max, W, H, PAD)
  const kiEnde = lastPoint(kiPts)
  const benchEnde = lastPoint(benchPts)

  const datum = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
  const schritt = snapshots.length > 1 ? (W - PAD * 2) / (snapshots.length - 1) : 0

  return (
    <Card title="📉 Equity-Kurve — KI vs. Sparplan">
      <div className="mb-2 flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-zinc-300">
          <span className="h-2 w-4 rounded-sm" style={{ background: KI_FARBE }} />
          KI-Portfolio · {eur(ki[ki.length - 1])}
        </span>
        <span className="flex items-center gap-1.5 text-zinc-300">
          <span className="h-2 w-4 rounded-sm" style={{ background: BENCH_FARBE }} />
          ETF-Sparplan · {eur(bench[bench.length - 1])}
        </span>
        <span className="ml-auto text-zinc-500">
          {datum(snapshots[0].day)} – {datum(snapshots[snapshots.length - 1].day)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W + 44} ${H}`} className="h-40 w-full min-w-[320px]" role="img"
          aria-label="Verlauf des Depotwerts: KI-Portfolio und ETF-Sparplan in Euro">
          {/* dezente Hilfslinien oben/Mitte/unten */}
          {[PAD, H / 2, H - PAD].map((y) => (
            <line key={y} x1={0} x2={W} y1={y} y2={y} stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2 4" />
          ))}
          <polyline points={benchPts} fill="none" stroke={BENCH_FARBE} strokeWidth="2" strokeLinejoin="round" />
          <polyline points={kiPts} fill="none" stroke={KI_FARBE} strokeWidth="2" strokeLinejoin="round" />
          {kiEnde && <circle cx={kiEnde.x} cy={kiEnde.y} r="3" fill={KI_FARBE} stroke="#18181b" strokeWidth="1" />}
          {benchEnde && <circle cx={benchEnde.x} cy={benchEnde.y} r="3" fill={BENCH_FARBE} stroke="#18181b" strokeWidth="1" />}
          {/* Direktbeschriftung am Serienende */}
          {kiEnde && (
            <text x={kiEnde.x + 6} y={kiEnde.y + 3} fontSize="9" fill="#a1a1aa">KI</text>
          )}
          {benchEnde && (
            <text x={benchEnde.x + 6} y={benchEnde.y + 3} fontSize="9" fill="#a1a1aa">ETF</text>
          )}
          {/* Hover-Ziele: ein unsichtbarer Streifen pro Tag mit nativem Tooltip */}
          {snapshots.map((s, i) => (
            <rect
              key={s.day}
              x={PAD + i * schritt - schritt / 2}
              y={0}
              width={Math.max(schritt, 4)}
              height={H}
              fill="transparent"
            >
              <title>{`${datum(s.day)}: KI ${eur(Number(s.ki_value_eur))} · ETF ${eur(Number(s.bench_value_eur))}`}</title>
            </rect>
          ))}
        </svg>
      </div>

      <p className="mt-1 text-xs text-zinc-600">
        Ein Punkt pro Handelstag (Tageslauf), Skala {eur(min)}–{eur(max)}. Beide Seiten investieren
        täglich 15€ Spielgeld — die Lücke zwischen den Linien ist der ganze Unterschied.
      </p>
    </Card>
  )
}
