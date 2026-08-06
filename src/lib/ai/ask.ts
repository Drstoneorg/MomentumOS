import type OpenAI from "openai"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { deepseek } from "@/lib/ai/deepseek"
import { assertBudget, logUsage } from "@/lib/ai/usage"
import { ASK_TOOL_BY_NAME, toolSchemas, werkzeugeFuerFrage } from "@/lib/ai/askTools"

/**
 * Frage-Schleife: Modell wählt Werkzeuge, wir führen sie aus, Modell antwortet.
 * Das Modell bekommt nie SQL und nie das Schema — nur die Werkzeugliste aus
 * askTools.ts und deren Rückgaben. Jeder Durchlauf wird für die Kostenrechnung
 * protokolliert, das Monatsbudget bremst wie überall sonst auch.
 *
 * Alles läuft als Stream: Antwort-Tokens gehen sofort per emit() raus, damit
 * die Antwort im Chat tröpfelt statt am Stück zu erscheinen. Werkzeug-Runden
 * melden sich als status-Ereignis; angefangener Text vor einem Werkzeugaufruf
 * wird per reset verworfen (das war Vorgeplänkel, nicht die Antwort).
 */

export type AskMessage = { role: "user" | "assistant"; content: string }
export type AskStep = { werkzeug: string; args: Record<string, unknown> }
export type AskResult = { antwort: string; schritte: AskStep[] }

export type AskEvent =
  | { t: "status"; text: string }
  | { t: "reset" }
  | { t: "delta"; text: string }
  | { t: "done"; schritte: AskStep[] }
  | { t: "error"; text: string }

/** Obergrenze gegen Endlosschleifen — mehr als vier Werkzeugrunden braucht keine Frage. */
const MAX_RUNDEN = 4
/** Wie viel Verlauf mitgeschickt wird. Ältere Fragen sind selten noch relevant. */
const HISTORIE_MAX = 6

const STATUS_LABELS: Record<string, string> = {
  finde_kontakt: "suche Kontakt",
  nachrichten_suchen: "durchsuche Nachrichten",
  gedaechtnis_suchen: "durchsuche Gedächtnis",
  kommende_termine: "prüfe Termine",
}

function systemPrompt(): string {
  const heute = new Date().toLocaleDateString("de-AT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  return `Du beantwortest Fragen zur persönlichen Plattform MomentumOS. Heute ist ${heute}.

Die Plattform hat fünf Module:
- MomentOS: Freunde, Familie, Geburtstage, Events, Meetups
- MatchOS: Kennenlernen, Gesprächs-Pipeline
- JobOS: Bewerbungen
- BookOS: Artist-Booking und Treatment-Buchungen
- TradingOS: Papierdepot mit Spielgeld
Dazu angebunden: AirbnbWorker (Ferienwohnungen — Reservierungen, Putzplan, Gäste-Nachrichten) aus einem zweiten Projekt.

Regeln:
1. Antworte AUSSCHLIESSLICH mit dem, was die Werkzeuge zurückgeben. Erfinde nichts — keine Namen, keine Daten, keine Zahlen.
2. Brauchst du eine kontakt_id, rufe zuerst finde_kontakt auf. Bei mehreren gleichnamigen Treffern frage nach, statt zu raten.
3. Liefert ein Werkzeug nichts, sage das klar: „dazu ist nichts erfasst“. Das ist eine gültige Antwort, kein Fehler. Verwechsle „nicht erfasst“ niemals mit „nicht passiert“.
4. Nenne konkrete Daten und Abstände: „am 14. Juni, das sind 47 Tage her“.
4a. Ein Datum VOR heute ist niemals ein kommender Termin. Liefert ein Werkzeug ein Feld faelligkeit, übernimm dessen Formulierung wörtlich — „überfällig seit 21 Tagen“ heißt überfällig, nicht „steht an“.
5. Hänge Links als Markdown an, wenn ein Werkzeug ein Feld link liefert.
6. Fasse dich kurz. Zwei bis fünf Sätze, Listen wenn es mehrere Einträge sind. Keine Einleitungsfloskeln.
7. Bei Fragen zu TradingOS immer dazusagen, dass es Spielgeld ist.
8. Antworte auf Deutsch.`
}

export async function askStream(
  db: SupabaseClient<Database>,
  frage: string,
  historie: AskMessage[],
  emit: (e: AskEvent) => void
): Promise<AskResult> {
  await assertBudget()
  const client = deepseek()

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt() },
    ...historie.slice(-HISTORIE_MAX).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: frage },
  ]

  const schritte: AskStep[] = []

  // Werkzeugliste nach Modul vorgefiltert — Historie zählt mit, damit
  // Nachfragen („und wie viele davon?“) im selben Modul bleiben.
  const angebot = werkzeugeFuerFrage([...historie.map((m) => m.content), frage].join(" "))

  for (let runde = 0; runde < MAX_RUNDEN; runde++) {
    const stream = await client.chat.completions.create({
      model: "deepseek-chat",
      messages,
      tools: toolSchemas(angebot),
      tool_choice: "auto",
      temperature: 0.2,
      stream: true,
      stream_options: { include_usage: true },
    })

    let content = ""
    let gestreamt = false
    const calls: { id: string; name: string; args: string }[] = []

    for await (const chunk of stream) {
      if (chunk.usage) {
        await logUsage({
          provider: "deepseek",
          model: "deepseek-chat",
          feature: "ask",
          tokensIn: chunk.usage.prompt_tokens,
          tokensOut: chunk.usage.completion_tokens,
        })
      }
      const delta = chunk.choices[0]?.delta
      if (!delta) continue
      if (delta.content) {
        content += delta.content
        // Solange keine Werkzeugwahl sichtbar ist, direkt durchreichen
        if (!calls.length) {
          gestreamt = true
          emit({ t: "delta", text: delta.content })
        }
      }
      for (const tc of delta.tool_calls ?? []) {
        const i = tc.index ?? 0
        calls[i] ??= { id: "", name: "", args: "" }
        if (tc.id) calls[i].id = tc.id
        if (tc.function?.name) calls[i].name += tc.function.name
        if (tc.function?.arguments) calls[i].args += tc.function.arguments
      }
    }

    if (!calls.length) {
      const antwort = content.trim() || "Keine Antwort erhalten."
      if (!gestreamt) emit({ t: "delta", text: antwort })
      emit({ t: "done", schritte })
      return { antwort, schritte }
    }

    // Werkzeugrunde: eventuell schon gestreamtes Vorgeplänkel zurücknehmen
    if (gestreamt) emit({ t: "reset" })

    messages.push({
      role: "assistant",
      content: content || null,
      tool_calls: calls.map((c) => ({
        id: c.id,
        type: "function" as const,
        function: { name: c.name, arguments: c.args || "{}" },
      })),
    })

    for (const call of calls) {
      const tool = ASK_TOOL_BY_NAME.get(call.name)
      let ergebnis: unknown
      if (!tool) {
        ergebnis = { fehler: `Unbekanntes Werkzeug: ${call.name}` }
      } else {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.args || "{}")
        } catch {
          args = {}
        }
        schritte.push({ werkzeug: tool.name, args })
        emit({ t: "status", text: STATUS_LABELS[tool.name] ?? `frage ${tool.name} ab` })
        try {
          ergebnis = await tool.run(db, args)
        } catch (e) {
          // Ein kaputtes Werkzeug darf die Frage nicht abbrechen — das Modell
          // bekommt den Fehler und kann es anders versuchen oder es sagen.
          ergebnis = { fehler: e instanceof Error ? e.message : String(e) }
        }
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(ergebnis),
      })
    }
  }

  const antwort =
    "Die Frage brauchte zu viele Schritte. Formuliere sie enger, zum Beispiel mit einem konkreten Namen."
  emit({ t: "delta", text: antwort })
  emit({ t: "done", schritte })
  return { antwort, schritte }
}

/** Nicht-streamende Variante (Telegram-Bot, Tests): sammelt den Stream ein. */
export async function ask(
  db: SupabaseClient<Database>,
  frage: string,
  historie: AskMessage[] = []
): Promise<AskResult> {
  return askStream(db, frage, historie, () => {})
}
