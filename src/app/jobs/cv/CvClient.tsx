"use client"

// Lebenslauf-Generator + druckfertige A4-Ansicht (Drucken → als PDF sichern).
// Die KI lektoriert nur — erfindet nichts, Fakten kommen aus dem CV-Profil.
// Layout ist rein hier (JSX/CSS): 3 Vorlagen + Akzentfarbe, live umschaltbar,
// ohne neu zu generieren. Nur die gewählte Vorlage wird gerendert/gedruckt.

import { useState, useTransition } from "react"
import { generateJobCvDocument, saveCvContact } from "@/lib/actions"
import type { CvDocument } from "@/lib/ai/jobs"
import { Card, inputCls, btnCls } from "@/components/ui"

type Template = "sidebar" | "modern" | "serif"

const TEMPLATES: { id: Template; label: string }[] = [
  { id: "sidebar", label: "Sidebar" },
  { id: "modern", label: "Modern" },
  { id: "serif", label: "Serif" },
]

const ACCENTS = [
  { name: "Violett", color: "#7c3aed", tint: "#f5f3ff" },
  { name: "Smaragd", color: "#059669", tint: "#ecfdf5" },
  { name: "Rosé", color: "#e11d48", tint: "#fff1f2" },
  { name: "Anthrazit", color: "#27272a", tint: "#f4f4f5" },
  { name: "Bernstein", color: "#b45309", tint: "#fffbeb" },
]

export function CvClient({ doc: initialDoc, contact: initialContact }: { doc: CvDocument | null; contact: string }) {
  const [doc, setDoc] = useState(initialDoc)
  const [contact, setContact] = useState(initialContact)
  const [wishes, setWishes] = useState("")
  const [msg, setMsg] = useState("")
  const [template, setTemplate] = useState<Template>("sidebar")
  const [accentIdx, setAccentIdx] = useState(0)
  const [pending, start] = useTransition()

  const accent = ACCENTS[accentIdx]

  function generate() {
    setMsg("KI lektoriert den Lebenslauf…")
    start(async () => {
      const r = await generateJobCvDocument(wishes.trim() || undefined)
      if (!r.doc) {
        setMsg(`Fehler: ${r.error ?? "unbekannt"}`)
        return
      }
      setDoc(r.doc)
      setMsg("✓ Lebenslauf generiert — Vorlage/Farbe wählen, dann Drucken/PDF")
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

            {doc && (
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500">Vorlage</span>
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTemplate(t.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs ${
                        template === t.id ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500">Farbe</span>
                  {ACCENTS.map((a, i) => (
                    <button
                      key={a.name}
                      title={a.name}
                      onClick={() => setAccentIdx(i)}
                      style={{ backgroundColor: a.color }}
                      className={`h-5 w-5 rounded-full ring-offset-2 ring-offset-zinc-900 ${
                        accentIdx === i ? "ring-2 ring-white" : ""
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {doc && template === "sidebar" && <SidebarDoc doc={doc} contact={contact} accent={accent} />}
      {doc && template === "modern" && <ModernDoc doc={doc} contact={contact} accent={accent} />}
      {doc && template === "serif" && <SerifDoc doc={doc} contact={contact} accent={accent} />}
    </>
  )
}

type Accent = (typeof ACCENTS)[number]
type DocProps = { doc: CvDocument; contact: string; accent: Accent }

const shell =
  "print-doc mx-auto max-w-[210mm] overflow-hidden rounded-xl bg-white text-zinc-900 shadow-xl print:rounded-none print:shadow-none"

/* ---------- Sidebar: linke Akzentspalte + Hauptspalte ---------- */
function SidebarDoc({ doc, contact, accent }: DocProps) {
  return (
    <div className={`${shell} flex`}>
      <aside className="w-[35%] p-7 text-[13px] leading-relaxed" style={{ backgroundColor: accent.tint }}>
        {contact && (
          <Block title="Kontakt" accent={accent}>
            <p className="whitespace-pre-line text-zinc-600">{contact.split("·").map((s) => s.trim()).join("\n")}</p>
          </Block>
        )}
        {doc.skill_groups.length > 0 && (
          <Block title="Kompetenzen" accent={accent}>
            <div className="space-y-2">
              {doc.skill_groups.map((g) => (
                <div key={g.title}>
                  <p className="font-semibold text-zinc-800">{g.title}</p>
                  <p className="text-zinc-600">{g.skills.join(" · ")}</p>
                </div>
              ))}
            </div>
          </Block>
        )}
        {doc.languages.length > 0 && (
          <Block title="Sprachen" accent={accent}>
            <ul className="space-y-0.5 text-zinc-600">
              {doc.languages.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Block>
        )}
        {doc.extras.length > 0 && (
          <Block title="Extras" accent={accent}>
            <ul className="space-y-0.5 text-zinc-600">
              {doc.extras.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Block>
        )}
      </aside>

      <main className="w-[65%] p-8">
        <header>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{doc.name}</h1>
          <p className="mt-1 text-[15px] font-medium" style={{ color: accent.color }}>
            {doc.title}
          </p>
        </header>
        {doc.summary && <p className="mt-4 text-[13px] leading-relaxed text-zinc-700">{doc.summary}</p>}

        {doc.experience.length > 0 && (
          <section className="mt-6">
            <Heading accent={accent}>Berufserfahrung</Heading>
            <div className="mt-3 space-y-4">
              {doc.experience.map((e, i) => (
                <Station key={i} e={e} accent={accent} />
              ))}
            </div>
          </section>
        )}

        {doc.education.length > 0 && (
          <section className="mt-6">
            <Heading accent={accent}>Ausbildung</Heading>
            <ul className="mt-2 space-y-1 text-[13px] text-zinc-700">
              {doc.education.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}

function Block({ title, accent, children }: { title: string; accent: Accent; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: accent.color }}>
        {title}
      </p>
      {children}
    </div>
  )
}

/* ---------- Modern: einspaltig, Akzentlinien, Chip-Skills ---------- */
function ModernDoc({ doc, contact, accent }: DocProps) {
  return (
    <div className={`${shell} p-10`}>
      <header className="pb-3" style={{ borderBottom: `3px solid ${accent.color}` }}>
        <h1 className="text-[30px] font-bold tracking-tight">{doc.name}</h1>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4">
          <p className="text-[16px] font-medium" style={{ color: accent.color }}>
            {doc.title}
          </p>
          {contact && <p className="text-[12px] text-zinc-500">{contact}</p>}
        </div>
      </header>

      {doc.summary && <p className="mt-4 text-[13px] leading-relaxed text-zinc-700">{doc.summary}</p>}

      {doc.experience.length > 0 && (
        <section className="mt-6">
          <Heading accent={accent}>Berufserfahrung</Heading>
          <div className="mt-3 space-y-4">
            {doc.experience.map((e, i) => (
              <Station key={i} e={e} accent={accent} />
            ))}
          </div>
        </section>
      )}

      {doc.skill_groups.length > 0 && (
        <section className="mt-6">
          <Heading accent={accent}>Kompetenzen</Heading>
          <div className="mt-3 space-y-2">
            {doc.skill_groups.map((g) => (
              <div key={g.title} className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
                <span className="text-[12px] font-semibold text-zinc-800">{g.title}:</span>
                {g.skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border px-2 py-0.5 text-[11px]"
                    style={{ borderColor: accent.color, color: accent.color }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 grid grid-cols-2 gap-6">
        {doc.education.length > 0 && (
          <section>
            <Heading accent={accent}>Ausbildung</Heading>
            <ul className="mt-2 space-y-1 text-[13px] text-zinc-700">
              {doc.education.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </section>
        )}
        {(doc.languages.length > 0 || doc.extras.length > 0) && (
          <section>
            <Heading accent={accent}>Sprachen & Extras</Heading>
            <ul className="mt-2 space-y-1 text-[13px] text-zinc-700">
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
  )
}

/* ---------- Serif: editorial, zentriert, feine Linien ---------- */
function SerifDoc({ doc, contact, accent }: DocProps) {
  const serif = { fontFamily: "Georgia, 'Times New Roman', serif" }
  return (
    <div className={`${shell} p-12`} style={serif}>
      <header className="text-center">
        <h1 className="text-[32px] font-bold tracking-wide">{doc.name}</h1>
        <p className="mt-1 text-[15px] italic text-zinc-600">{doc.title}</p>
        {contact && <p className="mt-2 text-[12px] text-zinc-500">{contact}</p>}
        <div className="mx-auto mt-4 h-px w-24" style={{ backgroundColor: accent.color }} />
      </header>

      {doc.summary && (
        <p className="mx-auto mt-5 max-w-[80%] text-center text-[13px] leading-relaxed text-zinc-700">{doc.summary}</p>
      )}

      {doc.experience.length > 0 && (
        <section className="mt-7">
          <SerifHeading>Berufserfahrung</SerifHeading>
          <div className="mt-3 space-y-4">
            {doc.experience.map((e, i) => (
              <div key={i} style={{ breakInside: "avoid" }}>
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-[14px] font-semibold">
                    {e.role} <span className="font-normal italic text-zinc-600">— {e.company}</span>
                  </p>
                  {e.period && <p className="shrink-0 text-[12px] text-zinc-500">{e.period}</p>}
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-zinc-700">
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
        <section className="mt-7">
          <SerifHeading>Kompetenzen</SerifHeading>
          <div className="mt-2 space-y-1 text-[13px] text-zinc-700">
            {doc.skill_groups.map((g) => (
              <p key={g.title}>
                <span className="font-semibold">{g.title}:</span> {g.skills.join(" · ")}
              </p>
            ))}
          </div>
        </section>
      )}

      <div className="mt-7 grid grid-cols-2 gap-8">
        {doc.education.length > 0 && (
          <section>
            <SerifHeading>Ausbildung</SerifHeading>
            <ul className="mt-2 space-y-1 text-[13px] text-zinc-700">
              {doc.education.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </section>
        )}
        {(doc.languages.length > 0 || doc.extras.length > 0) && (
          <section>
            <SerifHeading>Sprachen & Extras</SerifHeading>
            <ul className="mt-2 space-y-1 text-[13px] text-zinc-700">
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
  )
}

/* ---------- geteilte Bausteine ---------- */
function Heading({ accent, children }: { accent: Accent; children: React.ReactNode }) {
  return (
    <h2
      className="pb-1 text-[11px] font-bold uppercase tracking-widest"
      style={{ color: accent.color, borderBottom: `1px solid ${accent.color}33` }}
    >
      {children}
    </h2>
  )
}

function SerifHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-zinc-300 pb-1 text-[13px] font-bold uppercase tracking-[0.2em] text-zinc-700">
      {children}
    </h2>
  )
}

function Station({ e, accent }: { e: CvDocument["experience"][number]; accent: Accent }) {
  return (
    <div style={{ breakInside: "avoid" }}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[14px] font-semibold">
          {e.role} <span className="font-normal text-zinc-500">— {e.company}</span>
        </p>
        {e.period && <p className="shrink-0 text-[12px] text-zinc-500">{e.period}</p>}
      </div>
      <ul className="mt-1 space-y-0.5 text-[13px] text-zinc-700">
        {e.bullets.map((b, j) => (
          <li key={j} className="flex gap-2">
            <span style={{ color: accent.color }}>▸</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
