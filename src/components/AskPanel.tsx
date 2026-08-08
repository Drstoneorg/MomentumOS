"use client"

import { useRef, useState } from "react"
import Link from "next/link"

/**
 * Frage-Chat über die eigenen Daten. Schickt an /api/ask, das Modell dort wählt
 * lesende Werkzeuge aus. Jede Antwort zeigt, welche Werkzeuge sie gespeist
 * haben — eine falsch abgebogene Frage soll sichtbar sein, nicht unsichtbar.
 */

type Aktion = {
  aktion: string
  params: Record<string, unknown>
  beschreibung: string
  /** null = offen, sonst Ergebnis-Text nach Ausführen/Fehler */
  ergebnis?: { ok: boolean; text: string; href?: string } | null
}

type Nachricht = {
  role: "user" | "assistant"
  content: string
  schritte?: { werkzeug: string }[]
  fehler?: boolean
  status?: string | null
  aktionen?: Aktion[]
}

const BEISPIELE = [
  "Wann habe ich Mika das letzte Mal gesehen?",
  "Was steht in den nächsten zwei Wochen an?",
  "Wen habe ich zu lange nicht kontaktiert?",
  "Wie steht es um meine Bewerbungen?",
]

const WERKZEUG_LABELS: Record<string, string> = {
  finde_kontakt: "Kontaktsuche",
  aktion_vorschlagen: "Aktionsvorschlag",
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

    // Antwort kommt als NDJSON-Stream (status/reset/delta/done) und wird
    // tröpfelnd in die letzte Assistenten-Nachricht geschrieben.
    const setLetzte = (patch: Partial<Nachricht> | ((m: Nachricht) => Partial<Nachricht>)) =>
      setVerlauf((v) => {
        const kopie = [...v]
        const letzte = kopie[kopie.length - 1]
        if (!letzte || letzte.role !== "assistant") return v
        kopie[kopie.length - 1] = { ...letzte, ...(typeof patch === "function" ? patch(letzte) : patch) }
        return kopie
      })

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frage: sauber,
          historie: neu.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok || !res.body) {
        // Fehlerpfade (401/429/…) antworten weiter als JSON
        const roh = await res.text()
        let fehler = `Fehler ${res.status}`
        try {
          fehler = (JSON.parse(roh) as { error?: string }).error || fehler
        } catch {
          /* leerer Body */
        }
        setVerlauf([...neu, { role: "assistant", content: fehler, fehler: true }])
        return
      }

      setVerlauf([...neu, { role: "assistant", content: "", status: "denkt nach …" }])
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let puffer = ""
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        puffer += decoder.decode(value, { stream: true })
        const zeilen = puffer.split("\n")
        puffer = zeilen.pop() ?? ""
        for (const zeile of zeilen) {
          if (!zeile.trim()) continue
          let ev: {
            t: string
            text?: string
            schritte?: { werkzeug: string }[]
            aktion?: string
            params?: Record<string, unknown>
            beschreibung?: string
          }
          try {
            ev = JSON.parse(zeile)
          } catch {
            continue
          }
          if (ev.t === "aktion" && ev.aktion && ev.params && ev.beschreibung) {
            const neu: Aktion = {
              aktion: ev.aktion,
              params: ev.params,
              beschreibung: ev.beschreibung,
              ergebnis: null,
            }
            setLetzte((m) => ({ aktionen: [...(m.aktionen ?? []), neu] }))
          } else if (ev.t === "status") setLetzte({ status: ev.text ?? null })
          else if (ev.t === "reset") setLetzte({ content: "", status: null })
          else if (ev.t === "delta")
            setLetzte((m) => ({ content: m.content + (ev.text ?? ""), status: null }))
          else if (ev.t === "done") setLetzte({ schritte: ev.schritte, status: null })
          else if (ev.t === "error")
            setLetzte({ content: ev.text || "Fehler", fehler: true, status: null })
        }
        endeRef.current?.scrollIntoView({ behavior: "smooth" })
      }
      // Falls der Stream ohne done-Ereignis riss
      setLetzte((m) => (m.content ? {} : { content: "Verbindung abgerissen", fehler: true, status: null }))
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

  // Bestätigter Aktionsvorschlag: erst der Klick hier führt wirklich aus
  async function aktionAusfuehren(nachrichtIdx: number, aktionIdx: number, a: Aktion) {
    const setErgebnis = (ergebnis: Aktion["ergebnis"]) =>
      setVerlauf((v) =>
        v.map((m, i) =>
          i === nachrichtIdx && m.aktionen
            ? { ...m, aktionen: m.aktionen.map((x, xi) => (xi === aktionIdx ? { ...x, ergebnis } : x)) }
            : m
        )
      )
    try {
      const res = await fetch("/api/ask/aktion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: a.aktion, params: a.params }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        text?: string
        href?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        setErgebnis({ ok: false, text: data.error || `Fehler ${res.status}` })
        return
      }
      setErgebnis({ ok: true, text: data.text ?? "Erledigt", href: data.href })
    } catch {
      setErgebnis({ ok: false, text: "Netzwerkfehler — nochmal versuchen" })
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
                {m.status && (
                  <span className="block animate-pulse text-xs text-zinc-500">⚙ {m.status}</span>
                )}
                {m.aktionen?.map((a, ai) => (
                  <div
                    key={ai}
                    className="mt-2 rounded-lg border border-amber-800/60 bg-amber-950/20 p-2.5"
                  >
                    <p className="text-xs font-medium text-amber-200">⚡ {a.beschreibung}</p>
                    {a.ergebnis ? (
                      <p className={`mt-1 text-xs ${a.ergebnis.ok ? "text-emerald-400" : "text-red-400"}`}>
                        {a.ergebnis.ok ? "✓ " : "✕ "}
                        {a.ergebnis.text}
                        {a.ergebnis.href && (
                          <Link href={a.ergebnis.href} className="ml-1 underline underline-offset-2">
                            öffnen
                          </Link>
                        )}
                      </p>
                    ) : (
                      <button
                        onClick={() => aktionAusfuehren(i, ai, a)}
                        className="mt-1.5 rounded border border-amber-700 px-2.5 py-1 text-xs font-medium text-amber-200 hover:bg-amber-900/40"
                      >
                        ✓ Ausführen
                      </button>
                    )}
                  </div>
                ))}
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
