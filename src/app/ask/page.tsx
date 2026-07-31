import { Card } from "@/components/ui"
import { AskPanel } from "@/components/AskPanel"

export const dynamic = "force-dynamic"

export default function AskPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">🔮 Fragen</h1>
        <p className="text-sm text-zinc-400">
          Freitext-Fragen über alle fünf Module. Antworten kommen ausschließlich aus deiner Datenbank —
          was nicht erfasst ist, wird als „nicht erfasst“ gemeldet und nicht erfunden.
        </p>
      </div>

      <Card>
        <AskPanel hoehe="h-[60vh]" />
      </Card>

      <Card title="Was es kann">
        <ul className="space-y-1.5 text-sm text-zinc-400">
          <li>
            <span className="font-medium text-zinc-200">Personen:</span> letztes Treffen, letzter Nachrichtenwechsel,
            gemerkte Fakten, Profil, Verbindungs-Rhythmus
          </li>
          <li>
            <span className="text-zinc-200">Suche:</span> Volltext über Nachrichten und über das Gedächtnis
            aller Kontakte
          </li>
          <li>
            <span className="text-zinc-200">Termine:</span> Dates, Meetups, Events, Gigs, Follow-ups und
            Geburtstage in einem Zeitfenster
          </li>
          <li>
            <span className="text-zinc-200">Module:</span> Pipeline und Queue, Bewerbungen und Job-Funnel,
            Artists, Gigs und Buchungen, Papierdepot, Antwortquoten, KI-Kosten
          </li>
        </ul>
      </Card>
    </div>
  )
}
