import { createClient } from "@/lib/supabase/server"
import { STANDARD_VORLAGEN } from "@/lib/inviteTemplates"
import { Card } from "@/components/ui"
import { TemplateEditor } from "./TemplateEditor"

export const dynamic = "force-dynamic"

/**
 * Vorlagen-Editor: Einladungs- und Nachfass-Texte in der DB statt im Code —
 * Ton ändern ohne Deploy. Variante B neben A macht daraus einen A/B-Test:
 * beim Einladen wechseln sich die Varianten ab, die Antwortquote je Variante
 * steht direkt hier.
 */
export default async function VorlagenPage() {
  const supabase = await createClient()

  const [{ data: rows }, { data: abInvites }] = await Promise.all([
    supabase.from("templates").select("key, lang, variant, text, active"),
    supabase
      .from("event_invites")
      .select("template_variant, status")
      .not("template_variant", "is", null),
  ])

  // Aktuelle Texte: DB-Zeile schlägt Standard, leere Varianten bleiben leer
  const wert = new Map<string, string>()
  for (const s of STANDARD_VORLAGEN) wert.set(`${s.key}:${s.lang}:A`, s.text)
  for (const r of rows ?? []) {
    wert.set(`${r.key}:${r.lang}:${r.variant}`, r.active ? r.text : "")
  }

  // A/B-Quote: Reaktion (Zusage/Absage/Ticket/da) je Variante über alle Events
  const quote = new Map<string, { gesamt: number; reagiert: number; zusagen: number }>()
  for (const i of abInvites ?? []) {
    const v = i.template_variant!
    const q = quote.get(v) ?? { gesamt: 0, reagiert: 0, zusagen: 0 }
    q.gesamt++
    if (["yes", "no", "ticket", "attended"].includes(i.status)) q.reagiert++
    if (["yes", "ticket", "attended"].includes(i.status)) q.zusagen++
    quote.set(v, q)
  }

  const felder = [
    { key: "einladung", lang: "de" as const, titel: "Einladung (Deutsch)" },
    { key: "einladung", lang: "en" as const, titel: "Einladung (Englisch)" },
    { key: "nachfass", lang: "de" as const, titel: "Nachfass (Deutsch)" },
    { key: "nachfass", lang: "en" as const, titel: "Nachfass (Englisch)" },
  ].map((f) => ({
    ...f,
    varianteA: wert.get(`${f.key}:${f.lang}:A`) ?? "",
    varianteB: wert.get(`${f.key}:${f.lang}:B`) ?? "",
  }))

  const ab = [...quote.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">📝 Vorlagen</h1>
        <p className="text-sm text-zinc-400">
          Texte für Einladungs- und Nachfass-Entwürfe — Änderungen gelten sofort, ohne Deploy.
          Platzhalter: {"{name} {event} {datum} {ort} {link}"} · Stilregeln: kein Punkt am
          Satzende, keine Gedankenstriche
        </p>
      </div>

      {ab.length > 0 && (
        <Card title="🥇 A/B-Quote (Einladungen mit Variante)">
          <div className="flex flex-wrap gap-4 text-sm">
            {ab.map(([v, q]) => (
              <div key={v} className="rounded-lg bg-zinc-950 px-3 py-2">
                <p className="text-xs text-zinc-500">Variante {v}</p>
                <p className="text-zinc-200">
                  {q.reagiert}/{q.gesamt} reagiert
                  <span className="ml-2 text-emerald-300">{q.zusagen} Zusagen</span>
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-600">
            Zählt jede Einladung, die als Entwurf mit Variante rausging — der bessere Text darf
            Variante A werden
          </p>
        </Card>
      )}

      {felder.map((f) => (
        <TemplateEditor
          key={`${f.key}-${f.lang}`}
          titel={f.titel}
          vorlageKey={f.key}
          lang={f.lang}
          varianteA={f.varianteA}
          varianteB={f.varianteB}
        />
      ))}
    </div>
  )
}
