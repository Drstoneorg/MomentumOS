import { Card } from "@/components/ui"
import type { MatchScore } from "@/lib/scoring"

// Reine Anzeige — Score wird serverseitig auf der Kontaktseite berechnet.
export function MatchScoreCard({ score }: { score: MatchScore }) {
  return (
    <Card title="Match-Score">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-white">{score.score}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${score.color}`}>
          {score.label}
        </span>
      </div>
      <div className="space-y-2">
        {score.factors.map((f) => (
          <div key={f.key}>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>{f.label}</span>
              <span className="text-zinc-500">{f.note}</span>
            </div>
            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className={`h-full ${score.color}`} style={{ width: `${Math.round(f.value * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-zinc-500">
        Aus Chat-Verlauf + Pipeline-Stufe. Kein Kontakt-Fortschritt ⇒ niedrig.
      </p>
    </Card>
  )
}
