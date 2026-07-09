import { CaptureClient } from "./CaptureClient"

export const metadata = { title: "Erfassen — MatchOS" }

export default function CapturePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">📸 Kontakte erfassen</h1>
      <p className="text-sm text-zinc-400">
        Visitenkarten, Profil-Screenshots, Fotos von Kontaktdaten oder einfach Text
        (Nummer, E-Mail, Name) — KI liest alles aus, legt Kontakt + Kanäle an und
        erkennt Duplikate. Danach sofort kontaktierbar, Geburtstage laufen automatisch mit.
      </p>
      <CaptureClient />
    </div>
  )
}
