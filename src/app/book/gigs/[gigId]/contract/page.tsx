import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ARTIST_TYPE_LABELS, formatEuro } from "@/lib/artists"
import { ContractTools } from "./ContractTools"

export const dynamic = "force-dynamic"

/**
 * Druckfertiger Booking-Vertrag zu einem Gig (A4 weiß, PDF über Drucken-Dialog).
 * Nutzt dieselbe Print-CSS-Mechanik wie der Lebenslauf (.print-doc).
 */
export default async function GigContractPage({
  params,
}: {
  params: Promise<{ gigId: string }>
}) {
  const { gigId } = await params
  const supabase = await createClient()
  const [{ data: gig }, { data: orgRow }] = await Promise.all([
    supabase
      .from("gigs")
      .select("*, artists(*), events(title, starts_at, location)")
      .eq("id", gigId)
      .maybeSingle(),
    supabase.from("settings").select("value").eq("key", "organizer_profile").maybeSingle(),
  ])
  if (!gig || !gig.artists) notFound()

  const artist = gig.artists
  const event = gig.events
  const organizer = typeof orgRow?.value === "string" ? orgRow.value : ""
  const eventTitle = gig.title ?? event?.title ?? "Veranstaltung"
  const venue = gig.venue ?? event?.location ?? "____________________"
  const date = gig.gig_date
    ? new Date(`${gig.gig_date}T12:00:00`).toLocaleDateString("de-DE", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : event?.starts_at
      ? new Date(event.starts_at).toLocaleDateString("de-DE", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "____________________"

  return (
    <div className="space-y-4">
      <ContractTools artistId={gig.artist_id} organizer={organizer} />

      <div className="print-doc mx-auto max-w-[210mm] rounded-xl bg-white p-10 text-zinc-900 shadow-xl print:rounded-none print:shadow-none">
        <h1 className="text-center text-2xl font-bold tracking-wide">Booking-Vertrag</h1>

        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Veranstalter</p>
            <p className="mt-1 whitespace-pre-wrap">
              {organizer || "____________________\n____________________\n____________________"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Künstler:in ({ARTIST_TYPE_LABELS[artist.artist_type]})
            </p>
            <p className="mt-1 font-medium">{artist.name}</p>
            {artist.contact_name && <p>{artist.contact_name}</p>}
            {artist.contact_email && <p>{artist.contact_email}</p>}
            {artist.contact_phone && <p>{artist.contact_phone}</p>}
            {artist.city && <p>{artist.city}</p>}
          </div>
        </div>

        <div className="mt-8 space-y-5 text-sm leading-relaxed">
          <section>
            <h2 className="font-semibold">§1 Gegenstand</h2>
            <p>
              Der/die Künstler:in tritt bei der Veranstaltung „{eventTitle}“ am {date}
              {venue ? `, ${venue}` : ""} auf.
              {gig.set_slot ? ` Vereinbarter Set-Slot: ${gig.set_slot}.` : " Set-Slot nach Absprache."}
            </p>
          </section>

          <section>
            <h2 className="font-semibold">§2 Gage</h2>
            <p>
              Die Gage beträgt {gig.fee_cents ? formatEuro(gig.fee_cents) : "____________"}
              {gig.fee_note ? ` (${gig.fee_note})` : ""}. Zahlung am Veranstaltungstag bzw. per
              Überweisung binnen 7 Tagen nach Auftritt.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">§3 Technik & Hospitality</h2>
            <p>{artist.tech_rider ? `Technik: ${artist.tech_rider}` : "Technik gemäß gesonderter Absprache."}</p>
            <p>{artist.hospitality ? `Hospitality: ${artist.hospitality}` : "Hospitality gemäß gesonderter Absprache."}</p>
          </section>

          <section>
            <h2 className="font-semibold">§4 Absage</h2>
            <p>
              Bei Absage durch eine Partei weniger als 14 Tage vor dem Termin werden 50% der
              vereinbarten Gage fällig, sofern die Absage nicht auf höherer Gewalt beruht.
              Der Ausfall der Veranstaltung aus Gründen, die keine Partei zu vertreten hat,
              entbindet beide Seiten von ihren Pflichten.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">§5 Sonstiges</h2>
            <p>Nebenabreden bedürfen der Textform. Gerichtsstand ist der Sitz des Veranstalters.</p>
          </section>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="border-t border-zinc-400 pt-1">Ort, Datum — Veranstalter</p>
          </div>
          <div>
            <p className="border-t border-zinc-400 pt-1">Ort, Datum — Künstler:in</p>
          </div>
        </div>
      </div>
    </div>
  )
}
