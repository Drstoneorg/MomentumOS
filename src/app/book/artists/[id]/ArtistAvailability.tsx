import { Card } from "@/components/ui"
import { blocktTermin, freieWochenenden, kalenderWochen, GIG_STATUS_LABELS } from "@/lib/artists"
import type { Enums } from "@/lib/database.types"

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

type GigTermin = {
  gig_date: string | null
  status: Enums<"gig_status">
  title: string | null
  venue: string | null
}

/**
 * Verfügbarkeit aus den Gigs: drei Monatsraster ab heute, belegte Tage markiert,
 * darunter die nächsten freien Club-Wochenenden (Fr+Sa ohne Gig).
 */
export function ArtistAvailability({ gigs }: { gigs: GigTermin[] }) {
  const belegt = new Map<string, GigTermin>()
  for (const g of gigs) {
    if (g.gig_date && blocktTermin(g.status)) belegt.set(g.gig_date, g)
  }

  const heute = new Date()
  const heuteIso = heute.toISOString().slice(0, 10)
  const monate = [0, 1, 2].map((plus) => {
    const d = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth() + plus, 1))
    return { jahr: d.getUTCFullYear(), monat: d.getUTCMonth() + 1 }
  })
  const frei = freieWochenenden(new Set(belegt.keys()), heuteIso, 6)

  const datumKurz = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })

  return (
    <Card title="📅 Verfügbarkeit (aus den Gigs)">
      <div className="grid gap-4 sm:grid-cols-3">
        {monate.map(({ jahr, monat }) => (
          <div key={`${jahr}-${monat}`}>
            <p className="mb-1 text-xs font-semibold text-zinc-400">
              {new Date(Date.UTC(jahr, monat - 1, 1)).toLocaleDateString("de-DE", {
                month: "long",
                year: "numeric",
              })}
            </p>
            <table className="w-full table-fixed text-center text-[11px]">
              <thead>
                <tr className="text-zinc-600">
                  {WOCHENTAGE.map((w) => (
                    <th key={w} className="pb-1 font-normal">
                      {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kalenderWochen(jahr, monat).map((woche, wi) => (
                  <tr key={wi}>
                    {woche.map((iso, ti) => {
                      if (!iso) return <td key={ti} />
                      const gig = belegt.get(iso)
                      const wochenende = ti >= 4
                      const vergangen = iso < heuteIso
                      return (
                        <td key={ti} className="p-0.5">
                          <span
                            title={
                              gig
                                ? `${gig.title || gig.venue || "Gig"} · ${GIG_STATUS_LABELS[gig.status]}`
                                : undefined
                            }
                            className={`block rounded py-0.5 ${
                              gig
                                ? "bg-sky-900/70 font-medium text-sky-200"
                                : vergangen
                                  ? "text-zinc-700"
                                  : wochenende
                                    ? "bg-zinc-800/60 text-zinc-300"
                                    : "text-zinc-500"
                            } ${iso === heuteIso ? "ring-1 ring-amber-500" : ""}`}
                          >
                            {Number(iso.slice(8, 10))}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-zinc-800 pt-2">
        <p className="text-xs text-zinc-500">
          Nächste freie Club-Wochenenden (Fr+Sa ohne Gig):{" "}
          {frei.length === 0 ? (
            <span className="text-amber-300">keins in den nächsten 6 Monaten</span>
          ) : (
            frei.map((w, i) => (
              <span key={w.freitag} className="text-zinc-300">
                {i > 0 && " · "}
                {datumKurz(w.freitag)}–{datumKurz(w.samstag)}
              </span>
            ))
          )}
        </p>
      </div>
    </Card>
  )
}
