"use client"

// Lebenslauf-Generator + druckfertige A4-Ansicht (Drucken → als PDF sichern).
// Die KI lektoriert nur — erfindet nichts, Fakten kommen aus dem CV-Profil.

import { useState, useTransition } from "react"
import { generateJobCvDocument, saveCvContact } from "@/lib/actions"
import type { CvDocument } from "@/lib/ai/jobs"
import { Card, inputCls, btnCls } from "@/components/ui"

export function CvClient({ doc: initialDoc, contact: initialContact }: { doc: CvDocument | null; contact: string }) {
  const [doc, setDoc] = useState(initialDoc)
  const [contact, setContact] = useState(initialContact)
  const [wishes, setWishes] = useState("")
  const [msg, setMsg] = useState("")
  const [pending, start] = useTransition()

  function generate() {
    setMsg("KI lektoriert den Lebenslauf…")
    start(async () => {
      const r = await generateJobCvDocument(wishes.trim() || undefined)
      if (!r.doc) {
        setMsg(`Fehler: ${r.error ?? "unbekannt"}`)
        return
      }
      setDoc(r.doc)
      setMsg("✓ Lebenslauf generiert — unten prüfen, dann Drucken/PDF")
    })
  }

  return (
    <>
      <div className="print:hidden">
      <Card title="✨ Schöner Lebenslauf (KI-Lektorat, druckfertig)">
        <div className="space-y-2">
          <input
            className={inputCls}
            placeholder="Optionale Wünsche (z.B. 'Fokus auf Performance-Marketing', 'auf Englisch')"
            value={wishes}
            onChange={(e) => setWishes(e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Kontaktzeile fürs Dokument: E-Mail · Telefon · Ort"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            onBlur={() => start(async () => saveCvContact(contact))}
          />
          <div className="flex items-center gap-2">
            <button onClick={generate} disabled={pending} className={btnCls}>
              {pending ? "…" : doc ? "Neu generieren" : "Lebenslauf generieren"}
            </button>
            {doc && (
              <button onClick={() => window.print()} className={btnCls}>
                🖨 Drucken / als PDF sichern
              </button>
            )}
            {msg && <span className="text-sm text-zinc-400">{msg}</span>}
          </div>
        </div>
      </Card>
      </div>

      {doc && (
        <div className="print-doc mx-auto max-w-[210mm] rounded-xl bg-white p-10 text-zinc-900 shadow-xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
          <header className="border-b-2 border-zinc-900 pb-4">
            <h1 className="text-3xl font-bold tracking-tight">{doc.name}</h1>
            <p className="mt-1 text-lg text-zinc-600">{doc.title}</p>
            {contact && <p className="mt-1 text-sm text-zinc-500">{contact}</p>}
          </header>

          {doc.summary && <p className="mt-5 text-sm leading-relaxed text-zinc-700">{doc.summary}</p>}

          {doc.experience.length > 0 && (
            <section className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Berufserfahrung</h2>
              <div className="mt-2 space-y-4">
                {doc.experience.map((e, i) => (
                  <div key={i}>
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="font-semibold">
                        {e.role} <span className="font-normal text-zinc-600">— {e.company}</span>
                      </p>
                      {e.period && <p className="shrink-0 text-sm text-zinc-500">{e.period}</p>}
                    </div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-zinc-700">
                      {e.bullets.map((b, j) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {doc.skill_groups.length > 0 && (
            <section className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Kompetenzen</h2>
              <div className="mt-2 space-y-1 text-sm text-zinc-700">
                {doc.skill_groups.map((g) => (
                  <p key={g.title}>
                    <span className="font-semibold">{g.title}:</span> {g.skills.join(" · ")}
                  </p>
                ))}
              </div>
            </section>
          )}

          <div className="mt-6 grid grid-cols-2 gap-6">
            {doc.education.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Ausbildung</h2>
                <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                  {doc.education.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </section>
            )}
            {(doc.languages.length > 0 || doc.extras.length > 0) && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Sprachen & Extras</h2>
                <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                  {doc.languages.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                  {doc.extras.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  )
}
