import { sparklinePoints, lastPoint } from "@/lib/charts"

/**
 * Mini-Liniendiagramm für Bento-Kacheln: eine Serie, Flächenfüllung,
 * Punkt am aktuellen Ende. Bewusst ohne Achsen — Trend, nicht Analyse.
 */
export function Sparkline({
  values,
  color,
  height = 28,
  title,
}: {
  values: number[]
  color: string
  height?: number
  title?: string
}) {
  if (values.length < 2) return null
  const points = sparklinePoints(values, 100, height)
  const end = lastPoint(points)
  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="h-7 w-full"
      role="img"
      aria-label={title}
    >
      <polygon
        points={`2,${height - 1} ${points} 98,${height - 1}`}
        fill={color}
        opacity="0.12"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {end && <circle cx={end.x} cy={end.y} r="2" fill={color} vectorEffect="non-scaling-stroke" />}
    </svg>
  )
}
