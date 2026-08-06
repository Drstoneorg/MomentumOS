import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TfpTools } from "./TfpTools"

export const dynamic = "force-dynamic"

const BLANK = "____________________"

/**
 * Druckfertige TFP-Vereinbarung (Time for Prints) zu einem Recruit-Kontakt,
 * DE/EN umschaltbar. PDF entsteht über den Drucken-Dialog — dieselbe
 * .print-doc-Mechanik wie Booking-Vertrag und Lebenslauf.
 */

const TEXTE = {
  de: {
    titel: "TFP-Vereinbarung (Time for Prints)",
    fotograf: "Fotograf:in",
    model: "Model",
    paragraphen: [
      {
        h: "§1 Gegenstand",
        p: [
          `Die Parteien vereinbaren ein unentgeltliches Fotoshooting auf TFP-Basis: Statt einer Vergütung erhält das Model ${BLANK} bearbeitete Aufnahmen in digitaler Form, spätestens ${BLANK} Wochen nach dem Shooting.`,
        ],
      },
      {
        h: "§2 Termin und Ort",
        p: [`Shooting am ${BLANK} um ${BLANK} Uhr, Ort: ${BLANK}. Geplante Dauer: ${BLANK} Stunden.`],
      },
      {
        h: "§3 Nutzungsrechte",
        p: [
          "Beide Parteien erhalten ein einfaches, zeitlich unbefristetes Nutzungsrecht an den ausgewählten Aufnahmen für eigene Portfolios, eigene Social-Media-Profile und Eigenwerbung. Bei Veröffentlichung wird die jeweils andere Partei genannt bzw. verlinkt, soweit die Plattform das zulässt.",
          "Ein Verkauf der Aufnahmen oder eine Übertragung der Rechte an Dritte ist nur mit schriftlicher Zustimmung beider Parteien zulässig. Entstellende Bearbeitungen sind unzulässig.",
        ],
      },
      {
        h: "§4 Veröffentlichung und Widerruf",
        p: [
          "Das Model kann der Veröffentlichung einzelner Aufnahmen jederzeit mit Wirkung für die Zukunft widersprechen (Textform genügt). Bereits erfolgte, nicht mehr rückholbare Veröffentlichungen bleiben davon unberührt; online gestellte Aufnahmen werden nach Widerspruch binnen 14 Tagen entfernt.",
        ],
      },
      {
        h: "§5 Volljährigkeit und Ausweisprüfung",
        p: [
          `Das Model bestätigt, volljährig (18+) zu sein. Ein amtlicher Lichtbildausweis wurde vor dem Shooting geprüft am: ${BLANK}.`,
        ],
      },
      {
        h: "§6 Begleitung",
        p: ["Das Model darf zum Shooting eine Begleitperson mitbringen. Das ist ausdrücklich erwünscht."],
      },
      {
        h: "§7 Datenschutz",
        p: [
          "Kontaktdaten werden ausschließlich zur Abwicklung dieser Vereinbarung genutzt und nicht an Dritte weitergegeben. Auf Wunsch werden sie nach Abschluss gelöscht, soweit keine Aufbewahrungspflichten bestehen.",
        ],
      },
      {
        h: "§8 Sonstiges",
        p: [
          "Änderungen und Nebenabreden bedürfen der Textform. Sollte eine Bestimmung unwirksam sein, bleibt der Rest der Vereinbarung wirksam.",
        ],
      },
    ],
    unterschriftFotograf: "Ort, Datum — Fotograf:in",
    unterschriftModel: "Ort, Datum — Model",
    fussnote: "Muster-Dokument ohne Gewähr, keine Rechtsberatung.",
  },
  en: {
    titel: "TFP Agreement (Time for Prints)",
    fotograf: "Photographer",
    model: "Model",
    paragraphen: [
      {
        h: "§1 Subject",
        p: [
          `The parties agree on an unpaid photo shoot on a TFP basis: instead of a fee, the model receives ${BLANK} edited images in digital form, no later than ${BLANK} weeks after the shoot.`,
        ],
      },
      {
        h: "§2 Date and location",
        p: [`Shoot on ${BLANK} at ${BLANK}, location: ${BLANK}. Planned duration: ${BLANK} hours.`],
      },
      {
        h: "§3 Usage rights",
        p: [
          "Both parties receive a simple, perpetual licence to use the selected images for their own portfolios, their own social media profiles and self-promotion. When publishing, the other party is credited or tagged where the platform allows it.",
          "Selling the images or transferring rights to third parties requires written consent of both parties. Distorting edits are not permitted.",
        ],
      },
      {
        h: "§4 Publication and withdrawal",
        p: [
          "The model may object to the publication of individual images at any time with effect for the future (text form suffices). Publications that can no longer be recalled remain unaffected; images published online are removed within 14 days of an objection.",
        ],
      },
      {
        h: "§5 Age and ID check",
        p: [`The model confirms being of legal age (18+). A government photo ID was checked before the shoot on: ${BLANK}.`],
      },
      {
        h: "§6 Companion",
        p: ["The model may bring a companion to the shoot. This is expressly welcome."],
      },
      {
        h: "§7 Data protection",
        p: [
          "Contact details are used solely to carry out this agreement and are not shared with third parties. On request they are deleted after completion, unless retention duties apply.",
        ],
      },
      {
        h: "§8 Miscellaneous",
        p: [
          "Changes and side agreements require text form. Should any provision be invalid, the remainder of this agreement stays in force.",
        ],
      },
    ],
    unterschriftFotograf: "Place, date — photographer",
    unterschriftModel: "Place, date — model",
    fussnote: "Sample document without warranty, no legal advice.",
  },
} as const

export default async function TfpPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ lang?: string }>
}) {
  const { id } = await params
  const lang = (await searchParams).lang === "en" ? "en" : "de"
  const t = TEXTE[lang]

  const supabase = await createClient()
  const [{ data: contact }, { data: fotoRow }] = await Promise.all([
    supabase.from("contacts").select("id, name, platform, external_id, location").eq("id", id).maybeSingle(),
    supabase.from("settings").select("value").eq("key", "tfp_photographer").maybeSingle(),
  ])
  if (!contact) notFound()

  const photographer = typeof fotoRow?.value === "string" ? fotoRow.value : ""
  const handle =
    contact.platform === "instagram" && contact.external_id
      ? `@${contact.external_id.replace(/^@/, "")}`
      : null

  return (
    <div className="space-y-4">
      <TfpTools contactId={id} lang={lang} photographer={photographer} />

      <div className="print-doc mx-auto max-w-[210mm] rounded-xl bg-white p-10 text-zinc-900 shadow-xl print:rounded-none print:shadow-none">
        <h1 className="text-center text-2xl font-bold tracking-wide">{t.titel}</h1>

        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t.fotograf}</p>
            <p className="mt-1 whitespace-pre-wrap">{photographer || `${BLANK}\n${BLANK}\n${BLANK}`}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t.model}</p>
            <p className="mt-1 font-medium">{contact.name}</p>
            {handle && <p>{handle}</p>}
            <p>{contact.location ?? BLANK}</p>
            <p>{BLANK}</p>
            <p>{BLANK}</p>
          </div>
        </div>

        <div className="mt-8 space-y-5 text-sm leading-relaxed">
          {t.paragraphen.map((abs) => (
            <section key={abs.h}>
              <h2 className="font-semibold">{abs.h}</h2>
              {abs.p.map((satz, i) => (
                <p key={i}>{satz}</p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-14 grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="border-t border-zinc-400 pt-1">{t.unterschriftFotograf}</p>
          </div>
          <div>
            <p className="border-t border-zinc-400 pt-1">{t.unterschriftModel}</p>
          </div>
        </div>

        <p className="mt-8 text-center text-[10px] text-zinc-400">{t.fussnote}</p>
      </div>
    </div>
  )
}
