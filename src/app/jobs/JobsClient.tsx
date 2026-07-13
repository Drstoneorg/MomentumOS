"use client"

import { useMemo, useState, useTransition } from "react"
import {
  addJob,
  saveJobCv,
  updateJobStage,
  updateJobNotes,
  deleteJob,
  generateJobCoverLetter,
  generateJobInterviewPrep,
  saveSetting,
} from "@/lib/actions"
import type { CvProfile, InterviewPrep } from "@/lib/ai/jobs"
import type { Tables } from "@/lib/database.types"
import { Card, inputCls, btnCls } from "@/components/ui"

type Job = Tables<"job_applications">

const STAGES: { id: string; label: string }[] = [
  { id: "discovered", label: "🔍 Entdeckt" },
  { id: "applied", label: "📤 Beworben" },
  { id: "answered", label: "💬 Antwort" },
  { id: "interview", label: "🎤 Gespräch" },
  { id: "offer", label: "🎉 Angebot" },
  { id: "rejected", label: "❌ Absage" },
  { id: "inactive", label: "💤 Inaktiv" },
]

const CITIES = [
  { id: "alle", label: "Alle" },
  { id: "wien", label: "🇦🇹 Wien" },
  { id: "berlin", label: "🇩🇪 Berlin" },
  { id: "remote", label: "🌍 Remote" },
] as const

// Job-Portale mit Suchlinks — {q} wird durch Suchbegriff ersetzt.
const PORTALS: Record<"wien" | "berlin", { name: string; url: string }[]> = {
  wien: [
    { name: "LinkedIn", url: "https://www.linkedin.com/jobs/search/?keywords={q}&location=Wien" },
    { name: "karriere.at", url: "https://www.karriere.at/jobs/{q}/wien" },
    { name: "willhaben Jobs", url: "https://www.willhaben.at/jobs/suche?keyword={q}&location=Wien" },
    { name: "mediajobs.at", url: "https://www.mediajobs.at/jobs?what={q}" },
    { name: "StepStone AT", url: "https://www.stepstone.at/jobs/{q}/in-wien" },
    { name: "jobs.at", url: "https://www.jobs.at/j/{q}/wien" },
    { name: "hokify", url: "https://hokify.at/jobs?searchterm={q}&region=Wien" },
    { name: "derStandard", url: "https://jobs.derstandard.at/jobsuche/?query={q}" },
  ],
  berlin: [
    { name: "LinkedIn", url: "https://www.linkedin.com/jobs/search/?keywords={q}&location=Berlin" },
    { name: "StepStone DE", url: "https://www.stepstone.de/jobs/{q}/in-berlin" },
    { name: "Indeed DE", url: "https://de.indeed.com/jobs?q={q}&l=Berlin" },
    { name: "Berlin Startup Jobs", url: "https://berlinstartupjobs.com/?s={q}" },
    { name: "XING", url: "https://www.xing.com/jobs/search?keywords={q}&location=Berlin" },
    { name: "Arbeitsagentur", url: "https://www.arbeitsagentur.de/jobsuche/suche?was={q}&wo=Berlin" },
  ],
}

export function JobsClient({
  jobs,
  cv,
  autoTerms,
}: {
  jobs: Job[]
  cv: CvProfile | null
  autoTerms: string[]
}) {
  const [city, setCity] = useState<(typeof CITIES)[number]["id"]>("alle")
  const [pending, start] = useTransition()

  // Erfassen
  const [rawJob, setRawJob] = useState("")
  const [jobUrl, setJobUrl] = useState("")
  const [addMsg, setAddMsg] = useState("")

  // CV
  const [cvOpen, setCvOpen] = useState(!cv)
  const [cvText, setCvText] = useState("")
  const [cvUrl, setCvUrl] = useState("")
  const [cvMsg, setCvMsg] = useState("")

  // Suchbegriff für Portal-Links
  const [term, setTerm] = useState("")

  // Auto-Suche (täglicher Cron)
  const [autoInput, setAutoInput] = useState(autoTerms.join(", "))
  const [autoMsg, setAutoMsg] = useState("")

  const filtered = useMemo(
    () => (city === "alle" ? jobs : jobs.filter((j) => j.city === city)),
    [jobs, city]
  )
  const followupDue = jobs.filter(
    (j) =>
      j.stage === "applied" &&
      j.applied_at &&
      Date.now() - new Date(j.applied_at).getTime() > 14 * 86400_000
  )

  function submitJob() {
    if (rawJob.trim().length < 30) {
      setAddMsg("Stellentext einfügen (mind. 30 Zeichen) — z. B. komplette Anzeige kopieren.")
      return
    }
    setAddMsg("KI liest die Anzeige…")
    start(async () => {
      try {
        const r = await addJob(rawJob, jobUrl.trim() || undefined)
        setAddMsg(
          r.duplicate
            ? `Schon erfasst: ${r.job.company} — ${r.job.title}`
            : `✓ ${r.job.company} — ${r.job.title}${r.score ? ` · Match ${r.score.score}%` : " (kein CV-Score — erst CV speichern)"}`
        )
        setRawJob("")
        setJobUrl("")
      } catch (e) {
        setAddMsg(`Fehler: ${e instanceof Error ? e.message : "unbekannt"}`)
      }
    })
  }

  function submitCv() {
    setCvMsg("KI liest den Lebenslauf…")
    start(async () => {
      try {
        const r = await saveJobCv({ text: cvText.trim() || undefined, url: cvUrl.trim() || undefined })
        if (!r.profile) {
          setCvMsg(`Fehler: ${r.error ?? "unbekannt"}`)
          return
        }
        setCvMsg(`✓ Profil gespeichert: ${r.profile.headline || r.profile.name} · ${r.profile.skills.length} Skills`)
        setCvOpen(false)
      } catch (e) {
        setCvMsg(`Fehler: ${e instanceof Error ? e.message : "unbekannt"}`)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* CV-Profil */}
      <Card title={cv ? `📄 CV-Profil: ${cv.headline || cv.name}` : "📄 Lebenslauf hochladen (Basis für Match-Score + Anschreiben)"}>
        {cv && !cvOpen && (
          <div className="space-y-1 text-sm text-zinc-400">
            <p>{cv.skills.slice(0, 12).join(" · ")}</p>
            <div className="flex gap-3">
              <a href="/jobs/cv" className="text-emerald-400 hover:underline">
                📄 Profil ansehen + Lebenslauf generieren
              </a>
              <button onClick={() => setCvOpen(true)} className="text-rose-400 hover:underline">
                Aktualisieren
              </button>
            </div>
          </div>
        )}
        {cvOpen && (
          <div className="space-y-2">
            <input
              className={inputCls}
              placeholder="Lebenslauf-Webseite (URL) — wird ausgelesen"
              value={cvUrl}
              onChange={(e) => setCvUrl(e.target.value)}
            />
            <textarea
              className={`${inputCls} min-h-28`}
              placeholder="…oder Lebenslauf-Text hier einfügen (aus Word: alles markieren, kopieren, einfügen)"
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <button onClick={submitCv} disabled={pending} className={btnCls}>
                {pending ? "…" : "Profil extrahieren & speichern"}
              </button>
              {cvMsg && <span className="text-sm text-zinc-400">{cvMsg}</span>}
            </div>
          </div>
        )}
        {!cvOpen && cvMsg && <p className="text-sm text-zinc-400">{cvMsg}</p>}
      </Card>

      {/* Nachfassen fällig */}
      {followupDue.length > 0 && (
        <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
          ⏰ Nachfassen: {followupDue.map((j) => `${j.company} (${Math.round((Date.now() - new Date(j.applied_at!).getTime()) / 86400_000)}d)`).join(", ")}
        </div>
      )}

      {/* Stelle erfassen */}
      <Card title="➕ Stelle erfassen (Anzeige-Text einfügen, KI macht den Rest)">
        <div className="space-y-2">
          <input
            className={inputCls}
            placeholder="Link zur Anzeige (optional)"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
          />
          <textarea
            className={`${inputCls} min-h-24`}
            placeholder="Kompletten Anzeigentext hier einfügen…"
            value={rawJob}
            onChange={(e) => setRawJob(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button onClick={submitJob} disabled={pending} className={btnCls}>
              {pending ? "…" : "Erfassen + Match-Score"}
            </button>
            {addMsg && <span className="text-sm text-zinc-400">{addMsg}</span>}
          </div>
          <p className="text-xs text-zinc-500">
            Noch schneller: Extension auf LinkedIn & Co. — Alt+M auf der Anzeige drückt „Job erfassen".
          </p>
        </div>
      </Card>

      {/* Auto-Suche (Cron) */}
      <Card title="🤖 Auto-Suche — findet täglich neue Stellen von selbst">
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <label className="flex-1 text-sm text-zinc-400">
              Suchbegriffe (max. 3, Komma-getrennt)
              <input
                className={inputCls}
                placeholder="z. B. Marketing Video, Social Media Manager"
                value={autoInput}
                onChange={(e) => setAutoInput(e.target.value)}
              />
            </label>
            <button
              onClick={() =>
                start(async () => {
                  const terms = autoInput.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3)
                  await saveSetting("job_auto_search", JSON.stringify({ terms }))
                  setAutoMsg(terms.length ? `✓ Auto-Suche aktiv: ${terms.join(", ")}` : "Auto-Suche aus (keine Begriffe)")
                })
              }
              disabled={pending}
              className={btnCls}
            >
              {pending ? "…" : "Speichern"}
            </button>
          </div>
          {autoMsg && <p className="text-sm text-zinc-400">{autoMsg}</p>}
          <p className="text-xs text-zinc-500">
            Läuft täglich 6:30: durchsucht karriere.at, mediajobs.at, jobs.at (Wien) + Berlin Startup Jobs,
            erfasst neue Treffer mit Match-Score, generiert bei ≥65% das Anschreiben gleich mit und schickt dir eine Push.
            LinkedIn/StepStone/Indeed blocken Server — dort erfasst die Extension beim Browsen automatisch.
          </p>
        </div>
      </Card>

      {/* Portal-Suche Wien + Berlin */}
      <Card title="🔎 Jobsuche — ein Begriff, alle Portale">
        <div className="space-y-2">
          <input
            className={inputCls}
            placeholder="Suchbegriff, z. B. Marketing Video"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          {(["wien", "berlin"] as const).map((c) => (
            <div key={c} className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="w-16 text-zinc-500">{c === "wien" ? "🇦🇹 Wien" : "🇩🇪 Berlin"}</span>
              {PORTALS[c].map((p) => (
                <a
                  key={p.name}
                  href={p.url.replace("{q}", encodeURIComponent(term || ""))}
                  target="_blank"
                  className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-rose-500 hover:text-white"
                >
                  {p.name} ↗
                </a>
              ))}
            </div>
          ))}
          <p className="text-xs text-zinc-500">
            Treffer gefunden? Anzeige öffnen, Extension scannt (oder Text hier reinkopieren).
          </p>
        </div>
      </Card>

      {/* Stadt-Filter */}
      <div className="flex gap-1.5">
        {CITIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCity(c.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              city === c.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            {c.label} ({c.id === "alle" ? jobs.length : jobs.filter((j) => j.city === c.id).length})
          </button>
        ))}
      </div>

      {/* Pipeline */}
      {STAGES.map((s) => {
        const inStage = filtered.filter((j) => j.stage === s.id)
        if (!inStage.length) return null
        return (
          <Card key={s.id} title={`${s.label} (${inStage.length})`}>
            <div className="space-y-3">
              {inStage.map((j) => (
                <JobRow key={j.id} job={j} />
              ))}
            </div>
          </Card>
        )
      })}
      {!filtered.length && (
        <p className="text-sm text-zinc-500">
          Noch keine Stellen erfasst. Oben suchen, Anzeige kopieren, erfassen.
        </p>
      )}
    </div>
  )
}

function JobRow({ job }: { job: Job }) {
  const [pending, start] = useTransition()
  const [showLetter, setShowLetter] = useState(false)
  const [letter, setLetter] = useState(job.cover_letter ?? "")
  const [wishes, setWishes] = useState("")
  const [notes, setNotes] = useState(job.notes ?? "")
  const [msg, setMsg] = useState("")
  const [showPrep, setShowPrep] = useState(false)
  const [prep, setPrep] = useState<InterviewPrep | null>(
    (job.interview_prep as InterviewPrep | null) ?? null
  )

  function genPrep() {
    setMsg("Interview-Prep wird generiert…")
    start(async () => {
      try {
        const p = await generateJobInterviewPrep(job.id)
        setPrep(p)
        setShowPrep(true)
        setMsg("")
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Fehler")
      }
    })
  }
  const reasons = job.match_reasons as { hits?: string[]; missing?: string[]; verdict?: string } | null

  function genLetter() {
    setMsg("Anschreiben wird generiert…")
    start(async () => {
      try {
        const l = await generateJobCoverLetter(job.id, wishes.trim() || undefined)
        setLetter(l)
        setShowLetter(true)
        setMsg("")
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Fehler")
      }
    })
  }

  return (
    <div className="rounded-xl border border-zinc-800 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <p className="font-medium text-white">
            {job.title} <span className="text-zinc-400">· {job.company}</span>
          </p>
          <p className="text-xs text-zinc-500">
            {job.city}
            {job.salary ? ` · ${job.salary}` : ""}
            {job.url && (
              <>
                {" · "}
                <a href={job.url} target="_blank" className="text-rose-400 hover:underline">
                  Anzeige ↗
                </a>
              </>
            )}
          </p>
        </div>
        {job.match_score != null && (
          <span
            className={`rounded-lg px-2 py-1 text-xs font-semibold ${
              job.match_score >= 70
                ? "bg-emerald-900/50 text-emerald-300"
                : job.match_score >= 45
                  ? "bg-amber-900/50 text-amber-300"
                  : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {job.match_score}%
          </span>
        )}
        <select
          defaultValue={job.stage}
          onChange={(e) => start(() => updateJobStage(job.id, e.target.value))}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
        >
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            if (confirm(`${job.company} löschen?`)) start(() => deleteJob(job.id))
          }}
          className="text-sm text-zinc-600 hover:text-red-400"
        >
          ✕
        </button>
      </div>

      {reasons?.verdict && <p className="mt-1 text-xs text-zinc-400">{reasons.verdict}</p>}
      {reasons?.missing && reasons.missing.length > 0 && (
        <p className="mt-0.5 text-xs text-amber-400/80">Fehlt: {reasons.missing.join(", ")}</p>
      )}

      {job.next_action && (
        <div className="mt-2 rounded-lg border border-amber-800 bg-amber-950/30 p-2 text-xs text-amber-200">
          <p className="whitespace-pre-wrap">{job.next_action}</p>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(job.next_action!.replace(/^Nachfassen — Entwurf:\n/, ""))
              setMsg("✓ Entwurf kopiert")
              setTimeout(() => setMsg(""), 1500)
            }}
            className="mt-1 text-amber-300 hover:underline"
          >
            Kopieren
          </button>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {job.stage === "discovered" && (
          <button
            onClick={() => start(() => updateJobStage(job.id, "applied"))}
            disabled={pending}
            className="rounded-lg bg-emerald-900/60 px-2 py-1 text-emerald-200 hover:bg-emerald-800/60"
          >
            📤 Beworben
          </button>
        )}
        <button onClick={() => setShowLetter((v) => !v)} className="text-rose-400 hover:underline">
          {letter ? "Anschreiben anzeigen" : "✍️ Anschreiben generieren"}
        </button>
        <button
          onClick={() => (prep ? setShowPrep((v) => !v) : genPrep())}
          disabled={pending}
          className="text-violet-400 hover:underline"
        >
          {prep ? "🎤 Interview-Prep anzeigen" : "🎤 Interview-Prep generieren"}
        </button>
        {msg && <span className="text-zinc-400">{msg}</span>}
      </div>

      {showPrep && prep && (
        <div className="mt-2 space-y-3 rounded-xl border border-violet-900/60 bg-violet-950/20 p-3 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-violet-300">Wahrscheinliche Fragen</p>
            <ul className="space-y-2">
              {prep.questions.map((q, i) => (
                <li key={i}>
                  <p className="font-medium text-white">{q.q}</p>
                  <p className="text-xs text-zinc-400">{q.answer_hint}</p>
                </li>
              ))}
            </ul>
          </div>
          {prep.gaps.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-amber-300">Lücken + Antwortlinie</p>
              <ul className="space-y-1">
                {prep.gaps.map((g, i) => (
                  <li key={i} className="text-xs">
                    <span className="text-amber-200">{g.gap}</span>
                    <span className="text-zinc-400"> → {g.spin}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {prep.talking_points.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-emerald-300">Aktiv platzieren</p>
              <ul className="list-inside list-disc text-xs text-zinc-300">
                {prep.talking_points.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {prep.reverse_questions.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-sky-300">Eigene Rückfragen</p>
              <ul className="list-inside list-disc text-xs text-zinc-300">
                {prep.reverse_questions.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={genPrep} disabled={pending} className="text-xs text-zinc-500 hover:text-white">
            {pending ? "…" : "Neu generieren"}
          </button>
        </div>
      )}

      {showLetter && (
        <div className="mt-2 space-y-2">
          <input
            className={inputCls}
            placeholder="Wünsche fürs Anschreiben (optional), z. B. 'Video-Erfahrung betonen'"
            value={wishes}
            onChange={(e) => setWishes(e.target.value)}
          />
          <button onClick={genLetter} disabled={pending} className={btnCls}>
            {pending ? "…" : letter ? "Neu generieren" : "Generieren"}
          </button>
          {letter && (
            <>
              <textarea
                className={`${inputCls} min-h-40 text-sm`}
                value={letter}
                onChange={(e) => setLetter(e.target.value)}
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(letter)
                  setMsg("✓ kopiert")
                  setTimeout(() => setMsg(""), 1500)
                }}
                className={btnCls}
              >
                Kopieren
              </button>
            </>
          )}
        </div>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-zinc-500">Notizen</summary>
        <textarea
          className={`${inputCls} mt-1 min-h-16 text-sm`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => start(() => updateJobNotes(job.id, notes))}
          placeholder="Gehaltsvorstellung genannt, Rückruf Montag, …"
        />
      </details>
    </div>
  )
}
