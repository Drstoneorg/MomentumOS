import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { gastScore } from "@/lib/inviteScore"
import { zusagenMitBegleitung } from "@/lib/inviteScore"
import { noShowQuote, ueberbuchungsEmpfehlung } from "@/lib/noShow"
import { sendezeitProKontakt } from "@/lib/sendezeit"
import { InviteAssistant, type Eingeladen, type Kandidat, type MixZeile, type Segment, type WellenVorschlag } from "./InviteAssistant"

export const dynamic = "force-dynamic"

/** Außerhalb der Komponente wegen react-hooks/purity (Date.now im Render). */
function tageZurueckIso(tage: number): string {
  return new Date(Date.now() - tage * 86400_000).toISOString()
}

/** Wer ist seit 3+ Tagen ohne Antwort und nicht frisch erinnert — außerhalb der Komponente wegen react-hooks/purity. */
function zaehleNachfassFaellige(eingeladen: Eingeladen[]): number {
  const grenze = new Date(Date.now() - 3 * 86400_000).toISOString()
  const sperre = new Date(Date.now() - 4 * 86400_000).toISOString()
  return eingeladen.filter(
    (i) =>
      ["invited", "no_reply"].includes(i.status) &&
      i.created_at < grenze &&
      (!i.last_nudge_at || i.last_nudge_at < sperre)
  ).length
}

/** Zusagen nach Stadt und Kreis gruppiert — zeigt Schieflagen früh. */
function baueMix(
  invites: { status: string; contacts: { location: string | null; realm: string } | null }[]
): MixZeile[] {
  const zusagen = invites.filter((i) => ["yes", "ticket", "attended"].includes(i.status) && i.contacts)
  if (zusagen.length < 3) return []
  const staedte = new Map<string, number>()
  let freunde = 0
  for (const i of zusagen) {
    const stadt = (i.contacts!.location ?? "").split(/[\s,]+/).find((w) => w.length > 2) ?? "ohne Ort"
    staedte.set(stadt, (staedte.get(stadt) ?? 0) + 1)
    if (i.contacts!.realm === "moment") freunde++
  }
  const zeilen: MixZeile[] = [...staedte.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, n]) => ({ gruppe: "Stadt", label, n, anteil: n / zusagen.length }))
  zeilen.push({ gruppe: "Kreis", label: "Freundeskreis", n: freunde, anteil: freunde / zusagen.length })
  zeilen.push({
    gruppe: "Kreis",
    label: "Matches/Leads",
    n: zusagen.length - freunde,
    anteil: (zusagen.length - freunde) / zusagen.length,
  })
  return zeilen
}

/**
 * Einladungs-Assistent: alle Kontakte (Freunde, Matches, Recruit) nach Passung
 * zum Event sortiert, Historie über frühere Events fließt als Ermüdungsschutz
 * bzw. Zuverlässigkeits-Bonus ein. Dazu Wächter-Vorschläge, Segmente,
 * Sendezeit-Muster, No-Show-Mathe, Gäste-Mix und Chat-Zusagen-Vermutungen.
 */
export default async function EinladenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const nowIso = new Date().toISOString()

  const [
    { data: event },
    { data: contacts },
    { data: invites },
    { data: historie },
    { data: segmente },
    { data: vorschlag },
    { data: inboundMsgs },
    { data: pastInvites },
  ] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, location, audience, capacity, target_attendees")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("contacts")
      .select("id, name, realm, intent, location, relationship_tags, interests, avatar_url")
      .neq("pipeline_stage", "archived")
      .order("name"),
    supabase
      .from("event_invites")
      .select(
        "id, contact_id, status, wave, plus_ones, rsvp_token, created_at, last_nudge_at, companion_names, comment, suggested_status, suggested_quote, contacts(name, location, realm)"
      )
      .eq("event_id", id)
      .order("created_at"),
    supabase.from("event_invites").select("contact_id, status, feedback_rating"),
    supabase.from("guest_segments").select("id, name, contact_ids").order("name"),
    supabase
      .from("event_wave_proposals")
      .select("id, wave, contact_ids, reason, created_at")
      .eq("event_id", id)
      .is("accepted_at", null)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Sendezeit-Muster: eingehende Nachrichten der letzten 90 Tage
    supabase
      .from("messages")
      .select("contact_id, sent_at")
      .eq("direction", "in")
      .gte("sent_at", tageZurueckIso(90))
      .order("sent_at", { ascending: false })
      .limit(3000),
    // No-Show-Basis: Einladungen vergangener Events
    supabase
      .from("event_invites")
      .select("status, events!inner(starts_at)")
      .lt("events.starts_at", nowIso),
  ])
  if (!event) notFound()

  // Historie pro Kontakt über ALLE Events: wie oft eingeladen, wie oft reagiert, Feedback-Schnitt
  const hist = new Map<string, { eingeladen: number; reagiert: number; fbSumme: number; fbAnzahl: number }>()
  for (const h of historie ?? []) {
    const e = hist.get(h.contact_id) ?? { eingeladen: 0, reagiert: 0, fbSumme: 0, fbAnzahl: 0 }
    e.eingeladen++
    if (["yes", "no", "ticket", "attended"].includes(h.status)) e.reagiert++
    if (h.feedback_rating != null) {
      e.fbSumme += h.feedback_rating
      e.fbAnzahl++
    }
    hist.set(h.contact_id, e)
  }

  const sendezeiten = sendezeitProKontakt(inboundMsgs ?? [])

  const eingeladenIds = new Set((invites ?? []).map((i) => i.contact_id))
  const kandidaten: Kandidat[] = (contacts ?? [])
    .filter((c) => !eingeladenIds.has(c.id))
    .map((c) => {
      const h = hist.get(c.id)
      const { score, gruende } = gastScore(
        c,
        event,
        h
          ? {
              eingeladen: h.eingeladen,
              reagiert: h.reagiert,
              feedbackSchnitt: h.fbAnzahl ? h.fbSumme / h.fbAnzahl : null,
            }
          : { eingeladen: 0, reagiert: 0 }
      )
      return {
        id: c.id,
        name: c.name,
        realm: c.realm,
        avatar_url: c.avatar_url,
        score,
        gruende,
        sendezeit: sendezeiten.get(c.id) ?? null,
      }
    })
    .sort((a, b) => b.score - a.score)

  const eingeladen: Eingeladen[] = (invites ?? []).map((i) => ({
    id: i.id,
    contact_id: i.contact_id,
    name: i.contacts?.name ?? "?",
    status: i.status,
    wave: i.wave ?? 1,
    plus_ones: i.plus_ones ?? 0,
    rsvp_token: i.rsvp_token,
    created_at: i.created_at,
    last_nudge_at: i.last_nudge_at,
    companion_names: i.companion_names,
    comment: i.comment,
    suggested_status: i.suggested_status,
    suggested_quote: i.suggested_quote,
  }))

  const nachfassFaellig = zaehleNachfassFaellige(eingeladen)
  const stand = zusagenMitBegleitung(eingeladen)
  const ziel = event.target_attendees ?? event.capacity

  // No-Show-Mathe: aus allen vergangenen Events
  const noShow = noShowQuote(pastInvites ?? [])
  const empfehlung =
    ziel != null && noShow.quote != null && noShow.quote > 0.05
      ? ueberbuchungsEmpfehlung(ziel, noShow.quote)
      : null

  // Wächter-Vorschlag mit Namen anreichern
  const namenById = new Map((contacts ?? []).map((c) => [c.id, c.name]))
  const wellenVorschlag: WellenVorschlag | null = vorschlag
    ? {
        id: vorschlag.id,
        wave: vorschlag.wave,
        reason: vorschlag.reason,
        namen: vorschlag.contact_ids
          .filter((cid) => !eingeladenIds.has(cid))
          .map((cid) => namenById.get(cid) ?? "?")
          .slice(0, 12),
      }
    : null

  const mix = baueMix(invites ?? [])
  const segmentListe: Segment[] = (segmente ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    contact_ids: s.contact_ids,
  }))

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/moments/events/${id}`} className="text-sm text-amber-400 hover:underline">
          ← {event.title}
        </Link>
        <h1 className="mt-1 text-xl font-bold">Einladen</h1>
        <p className="text-sm text-zinc-400">
          {stand.gesamt} kommen ({stand.zusagen} Zusagen + {stand.begleitungen} Begleitungen)
          {ziel ? ` · Ziel ${ziel}` : ""}
          {empfehlung && noShow.quote != null
            ? ` · No-Show-Quote bisher ${Math.round(noShow.quote * 100)} % — peile ${empfehlung} Zusagen an`
            : ""}
          {" "}— sortiert nach Passung, jede Einstufung erklärt sich über die Chips
        </p>
      </div>
      <InviteAssistant
        eventId={id}
        kandidaten={kandidaten}
        eingeladen={eingeladen}
        nachfassFaellig={nachfassFaellig}
        segmente={segmentListe}
        wellenVorschlag={wellenVorschlag}
        mix={mix}
      />
    </div>
  )
}
