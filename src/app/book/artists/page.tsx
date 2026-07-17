import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui"
import {
  ARTIST_TYPE_LABELS,
  GIG_STATUS_COLOR,
  GIG_STATUS_LABELS,
  formatEuro,
  formatFeeRange,
  gigFeeTotals,
  gigStaleDays,
} from "@/lib/artists"
import { NewArtistButton } from "./NewArtistButton"
import { GigQuickActions } from "./GigQuickActions"

export const dynamic = "force-dynamic"

export default async function ArtistsPage() {
  const supabase = await createClient()
  const [{ data: artists }, { data: gigs }] = await Promise.all([
    supabase
      .from("artists")
      .select("*")
      .order("active", { ascending: false })
      .order("name"),
    supabase
      .from("gigs")
      .select("*, artists(name), events(title, starts_at)")
      .order("gig_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ])

  const allGigs = gigs ?? []
  const openGigs = allGigs.filter((g) => g.status !== "played" && g.status !== "cancelled")
  const doneGigs = allGigs.filter((g) => g.status === "played")
  const { fixedCents, pendingCents } = gigFeeTotals(allGigs)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">🎧 Artist-Booking</h1>
        <NewArtistButton />
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Roster", value: String(artists?.filter((a) => a.active).length ?? 0) },
          { label: "Offene Gigs", value: String(openGigs.length) },
          { label: "Gagen fix", value: formatEuro(fixedCents) },
          { label: "Gagen offen", value: formatEuro(pendingCents) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className="text-lg font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <Card title={`Gig-Pipeline (${openGigs.length})`}>
        {openGigs.length ? (
          <ul className="divide-y divide-zinc-800">
            {openGigs.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Link
                  href={`/book/artists/${g.artist_id}`}
                  className="font-medium text-white hover:underline"
                >
                  {g.artists?.name}
                </Link>
                <span className="text-zinc-400">
                  {g.title ?? g.events?.title ?? "—"}
                  {g.venue ? ` · ${g.venue}` : ""}
                  {g.gig_date
                    ? ` · ${new Date(`${g.gig_date}T12:00:00`).toLocaleDateString("de-DE")}`
                    : ""}
                  {g.set_slot ? ` · ${g.set_slot}` : ""}
                </span>
                {g.fee_cents ? (
                  <span className="text-zinc-300">{formatEuro(g.fee_cents)}</span>
                ) : null}
                {gigStaleDays(g.status, g.status_changed_at) != null && (
                  <span
                    className="rounded-full bg-amber-950/60 px-2 py-0.5 text-xs text-amber-300"
                    title="Seit Tagen keine Bewegung — auf der Artist-Seite Erinnerung entwerfen"
                  >
                    ⏰ {gigStaleDays(g.status, g.status_changed_at)}d ohne Antwort
                  </span>
                )}
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-xs ${GIG_STATUS_COLOR[g.status]}`}
                >
                  {GIG_STATUS_LABELS[g.status]}
                </span>
                <GigQuickActions gigId={g.id} artistId={g.artist_id} status={g.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">
            Keine offenen Gigs — auf einer Artist-Seite einen Gig anlegen
          </p>
        )}
      </Card>

      <Card title={`Roster (${artists?.length ?? 0})`}>
        {artists?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {artists.map((a) => (
              <Link
                key={a.id}
                href={`/book/artists/${a.id}`}
                className={`rounded-xl border border-zinc-800 p-3 hover:border-zinc-600 ${
                  a.active ? "bg-zinc-950" : "bg-zinc-950 opacity-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-white">{a.name}</p>
                  <span className="rounded-full bg-sky-950/60 px-2 py-0.5 text-xs text-sky-300">
                    {ARTIST_TYPE_LABELS[a.artist_type]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {a.city ?? "—"}
                  {a.rating ? ` · ${"★".repeat(a.rating)}` : ""}
                  {formatFeeRange(a.fee_min_cents, a.fee_max_cents)
                    ? ` · ${formatFeeRange(a.fee_min_cents, a.fee_max_cents)}`
                    : ""}
                </p>
                {a.genres.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {a.genres.map((genre) => (
                      <span
                        key={genre}
                        className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            Noch keine Artists — oben rechts den ersten anlegen
          </p>
        )}
      </Card>

      {doneGigs.length > 0 && (
        <Card title={`Gespielt (${doneGigs.length})`}>
          <ul className="space-y-1 text-sm text-zinc-400">
            {doneGigs.map((g) => (
              <li key={g.id}>
                <Link href={`/book/artists/${g.artist_id}`} className="text-zinc-200 hover:underline">
                  {g.artists?.name}
                </Link>{" "}
                — {g.title ?? g.events?.title ?? "—"}
                {g.gig_date
                  ? ` · ${new Date(`${g.gig_date}T12:00:00`).toLocaleDateString("de-DE")}`
                  : ""}
                {g.fee_cents ? ` · ${formatEuro(g.fee_cents)}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
