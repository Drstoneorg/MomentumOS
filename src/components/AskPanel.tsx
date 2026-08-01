"use client"

import { useRef, useState } from "react"
import Link from "next/link"

/**
 * Frage-Chat über die eigenen Daten. Schickt an /api/ask, das Modell dort wählt
 * lesende Werkzeuge aus. Jede Antwort zeigt, welche Werkzeuge sie gespeist
 * haben — eine falsch abgebogene Frage soll sichtbar sein, nicht unsichtbar.
 */

type Nachricht = {
  role: "user" | "assistant"
  content: string
  schritte?: { werkzeug: string }[]
  fehler?: boolean
}

const BEISPIELE = [
  "Wann habe ich Mika das letzte Mal gesehen?",
  "Was steht in den nächsten zwei Wochen an?",
  "Wen habe ich zu lange nicht kontaktiert?",
  "Wie steht es um meine Bewerbungen?",
]

const WERKZEUG_LABELS: Record<string, string> = {
  finde_kontakt: "Kontaktsuche",
  kontakt_profil: "Profil",
  kontakt_gedaechtnis: "Gedächtnis",
  letzter_kontakt: "Nachrichtenverlauf",
  letztes_treffen: "Treffen",
  nachrichten_suchen: "Nachrichtensuche",
  gedaechtnis_suchen: "Gedächtnissuche",
  kommende_termine: "Termine",
  vernachlaessigte_kontakte: "Rhythmus",
  geburtstage: "Geburtstage",
  events_uebersicht: "Events",
  pipeline_uebersicht: "Pipeline",
  offene_entwuerfe: "Queue",
  bewerbungen: "Bewerbungen",
  job_funnel: "Job-Funnel",
  artists_und_gigs: "Artists & Gigs",
  buchungen: "Buchungen",
  trading_stand: "Papierdepot",
  antwortquoten: "Antwortquoten",
  ki_kosten: "KI-Kosten",
  plattform_statistik: "Statistik",
  airbnb_reservierungen: "Airbnb-Reservierungen",
  airbnb_putzplan: "Putzplan",
  airbnb_gaeste_nachrichten: "Airbnb-Gäste",
  airbnb_worker_status: "Airbnb-Worker",
  airbnb_status: "Airbnb-Anbindung",
}

/** Minimaler Markdown-Ersatz: Links und Fettes. Bewusst kein HTML-Einschleusen. */
function renderText(text: string) {
  const teile: React.ReactNode[] = []
  const regex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) teile.push(text.slice(last, m.index))
    if (m[1] && m[2]) {
      const href = m[2]
      teile.push(
        href.startsWith("/") ? (
          <Link key={i++} href={href} className="text-rose-400 underline underline-offset-2 hover:text-rose-300">
            {m[1]}
          </Link>
        ) : (
          <span key={i++}>{m[1]}</span>
        )
      )
    } else if (m[3]) {
      teile.push(
        <strong key={i++} className="font-semibold text-zinc-100">
          {m[3]}
        </strong>
      )
    }
    last = regex.lastIndex
  }
  if (last < text.length) teile.push(text.slice(last))
  return teile
}

export function AskPanel({ hoehe = "h-80" }: { hoehe?: string }) {
  const [verlauf, setVerlauf] = useState<Nachricht[]>([])
  const [frage, setFrage] = useState("")
  const [laeuft, setLaeuft] = useState(false)
  const endeRef = useRef<HTMLDivElement>(null)

  async function senden(text: string) {
    const sauber = text.trim()
    if (!sauber || laeuft) return
    setFrage("")
    const neu: Nachricht[] = [...verlauf, { role: "user", content: sauber }]
    setVerlauf(neu)
    setLaeuft(true)
    setTimeout(() => endeRef.current?.scrollIntoView({ behavior: "smooth" }), 50)

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frage: sauber,
          historie: neu.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      // Ein Serverfehler kann mit leerem Body kommen — dann darf hier kein
      // JSON-Parsefehler die eigentliche Ursache verdecken.
      const roh = await res.text()
      let data: { antwort?: string; schritte?: { werkzeug: string }[]; error?: string } = {}
      try {
        data = roh ? JSON.parse(roh) : {}
      } catch {
        data = { error: `Server antwortete mit ${res.status} ohne verwertbaren Inhalt` }
      }
      setVerlauf([
        ...neu,
        res.ok && data.antwort
          ? { role: "assistant", content: data.antwort, schritte: data.schritte }
          : { role: "assistant", content: data.error || `Fehler ${res.status}`, fehler: true },
      ])
    } catch (e) {
      setVerlauf([
        ...neu,
        { role: "assistant", content: e instanceof Error ? e.message : "Netzwerkfehler", fehler: true },
      ])
    } finally {
      setLaeuft(false)
      setTimeout(() => endeRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`${hoehe} overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-3`}>
        {verlauf.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="text-3xl opacity-60">🔮</span>
            <p className="text-sm text-zinc-500">Frag etwas über deine Daten.</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {BEISPIELE.map((b) => (
                <button
                  key={b}
                  onClick={() => senden(b)}
                  className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-rose-700 hover:text-rose-300"
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {verlauf.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-lg bg-rose-950/50 px-3 py-2 text-sm text-rose-100"
                    : `max-w-[95%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.fehler ? "bg-red-950/40 text-red-300" : "bg-zinc-900 text-zinc-200"}`
                }
              >
                {renderText(m.content)}
                {!!m.schritte?.length && (
                  <div className="mt-2 flex flex-wrap gap-1 border-t border-zinc-800 pt-2">
                    {[...new Set(m.schritte.map((s) => s.werkzeug))].map((w) => (
                      <span key={w} className="rounded bg-zinc-800 px-1.5 py-px text-[10px] text-zinc-400">
                        {WERKZEUG_LABELS[w] ?? w}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {laeuft && <div className="px-3 text-sm text-zinc-500">denkt nach …</div>}
          <div ref={endeRef} />
        </div>
      </div>

      <div className="flex gap-2">
        <textarea
          rows={1}
          value={frage}
          onChange={(e) => setFrage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              senden(frage)
            }
          }}
          placeholder="Wann habe ich … zuletzt gesehen?"
          className="flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500"
        />
        <button
          onClick={() => senden(frage)}
          disabled={laeuft || !frage.trim()}
          className="shrink-0 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-40"
        >
          Fragen
        </button>
      </div>
      {verlauf.length > 0 && (
        <button onClick={() => setVerlauf([])} className="self-start text-xs text-zinc-500 hover:text-zinc-300">
          Verlauf leeren
        </button>
      )}
    </div>
  )
}
