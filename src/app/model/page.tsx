import type { Metadata } from "next"
import { ApplyForm } from "./ApplyForm"

export const metadata: Metadata = {
  title: "TFP-Shootings für Alternative & Goth Models — Wien · Berlin · London",
  description:
    "Kostenloses Foto- und Videoshooting auf TFP-Basis für alternative Models. Bewerbung in zwei Minuten.",
}

/**
 * Öffentliche RecruitOS-Landing-Page. Bewusst ohne App-Navigation (Nav blendet
 * sich auf /model aus) und ohne Login — der einzige Schreibweg ist /api/apply.
 */
export default function ModelLandingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 py-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-fuchsia-400">
          Wien · Berlin · London
        </p>
        <h1 className="text-3xl font-semibold leading-tight">
          TFP-Shootings für Alternative & Goth Models
        </h1>
        <p className="text-zinc-400">
          Kostenloses Foto- und Videoshooting auf TFP-Basis: du bekommst professionelle
          Aufnahmen und fertige Edits für dein Portfolio und deine Social-Media-Kanäle,
          ich darf ausgewählte Ergebnisse als Referenz zeigen. Kein Haken, keine Kosten,
          keine Verpflichtung.
        </p>
      </header>

      <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 text-sm text-zinc-300">
        <h2 className="text-base font-medium text-zinc-100">So läuft es</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Du bewirbst dich unten — ich melde mich innerhalb weniger Tage zurück.</li>
          <li>Wir planen gemeinsam: Stil, Ort, Termin, Moodboard.</li>
          <li>
            Vor dem Shooting unterschreiben wir einen TFP-Vertrag (Model-Release), der
            die Nutzungsrechte für beide Seiten klar regelt.
          </li>
          <li>Nur 18+ — Ausweis wird vor dem Shooting geprüft.</li>
          <li>Begleitperson ist ausdrücklich willkommen.</li>
          <li>Du bekommst die Auswahl und die fertigen Edits kostenlos.</li>
        </ul>
      </section>

      <ApplyForm />

      <footer className="space-y-1 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
        <p>
          Datenhinweis: Deine Angaben werden ausschließlich zur Bearbeitung deiner
          Bewerbung und zur Kontaktaufnahme gespeichert und nicht an Dritte gegeben.
          Löschung jederzeit auf Zuruf über die angegebene Kontaktmöglichkeit.
        </p>
      </footer>
    </div>
  )
}
