import { chatJSON } from "@/lib/ai/deepseek"
import { formatEuro } from "@/lib/artists"

export type InquiryContext = {
  artistName: string
  contactName?: string | null
  artistType: string
  genres: string[]
  eventTitle?: string | null
  eventDate?: string | null
  venue?: string | null
  setSlot?: string | null
  feeCents?: number | null
  feeNote?: string | null
  notes?: string | null
  wishes?: string | null
}

const SYSTEM = `Du schreibst Booking-Anfragen an DJs, Live-Acts und Performer für Club-Events — im Namen des Veranstalters.

Ton: professionell, freundlich, auf Augenhöhe der Szene. Kein Behördendeutsch, kein Fan-Gesäusel.

Harte Regeln:
- NICHTS erfinden. Nur die übergebenen Fakten nennen (Event, Datum, Venue, Slot, Gage). Fehlt eine Angabe, offen formulieren ("Details klären wir gern direkt").
- Eine genannte Gage exakt übernehmen, nie runden oder schätzen.
- 90 bis 150 Wörter für die Nachricht.
- Aufbau: kurze Vorstellung als Veranstalter, Event-Eckdaten, konkrete Anfrage (Datum/Slot), Gagen- bzw. Deal-Hinweis falls vorhanden, Bitte um Rückmeldung und Tech-Rider.
- Sprache: Deutsch.

Antworte NUR als JSON: {"subject": "Betreffzeile", "message": "Nachricht"}`

// Entwirft eine Booking-Anfrage (E-Mail/DM) an einen Artist. Reiner Entwurf —
// gesendet wird wie überall in der App nur manuell durch den User.
export async function draftArtistInquiry(
  ctx: InquiryContext,
): Promise<{ subject: string; message: string }> {
  const facts = [
    `Artist: ${ctx.artistName} (${ctx.artistType}${ctx.genres.length ? `, ${ctx.genres.join("/")}` : ""})`,
    ctx.contactName ? `Ansprechperson: ${ctx.contactName}` : null,
    ctx.eventTitle ? `Event: ${ctx.eventTitle}` : null,
    ctx.eventDate ? `Datum: ${ctx.eventDate}` : null,
    ctx.venue ? `Venue: ${ctx.venue}` : null,
    ctx.setSlot ? `Set-Slot: ${ctx.setSlot}` : null,
    ctx.feeCents ? `Gagen-Angebot: ${formatEuro(ctx.feeCents)}` : null,
    ctx.feeNote ? `Deal-Hinweis: ${ctx.feeNote}` : null,
    ctx.notes ? `Interne Notizen: ${ctx.notes}` : null,
    ctx.wishes ? `Zusätzliche Wünsche für den Text: ${ctx.wishes}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const raw = await chatJSON(SYSTEM, facts, "artist_inquiry")
  try {
    const parsed = JSON.parse(raw) as { subject?: unknown; message?: unknown }
    const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : ""
    const message = typeof parsed.message === "string" ? parsed.message.trim() : ""
    if (!message) throw new Error("leer")
    return { subject: subject || `Booking-Anfrage ${ctx.eventTitle ?? ""}`.trim(), message }
  } catch {
    throw new Error("KI-Antwort unbrauchbar — nochmal versuchen")
  }
}
