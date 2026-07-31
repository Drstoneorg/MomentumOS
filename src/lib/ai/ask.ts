import type OpenAI from "openai"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { deepseek } from "@/lib/ai/deepseek"
import { assertBudget, logUsage } from "@/lib/ai/usage"
import { ASK_TOOL_BY_NAME, toolSchemas } from "@/lib/ai/askTools"

/**
 * Frage-Schleife: Modell wählt Werkzeuge, wir führen sie aus, Modell antwortet.
 * Das Modell bekommt nie SQL und nie das Schema — nur die Werkzeugliste aus
 * askTools.ts und deren Rückgaben. Jeder Durchlauf wird für die Kostenrechnung
 * protokolliert, das Monatsbudget bremst wie überall sonst auch.
 */

export type AskMessage = { role: "user" | "assistant"; content: string }
export type AskStep = { werkzeug: string; args: Record<string, unknown> }
export type AskResult = { antwort: string; schritte: AskStep[] }

/** Obergrenze gegen Endlosschleifen — mehr als vier Werkzeugrunden braucht keine Frage. */
const MAX_RUNDEN = 4
/** Wie viel Verlauf mitgeschickt wird. Ältere Fragen sind selten noch relevant. */
const HISTORIE_MAX = 6

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

export async function ask(
  db: SupabaseClient<Database>,
  frage: string,
  historie: AskMessage[] = []
): Promise<AskResult> {
  await assertBudget()
  const client = deepseek()

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt() },
    ...historie.slice(-HISTORIE_MAX).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: frage },
  ]

  const schritte: AskStep[] = []

  for (let runde = 0; runde < MAX_RUNDEN; runde++) {
    const res = await client.chat.completions.create({
      model: "deepseek-chat",
      messages,
      tools: toolSchemas(),
      tool_choice: "auto",
      temperature: 0.2,
    })
    await logUsage({
      provider: "deepseek",
      model: "deepseek-chat",
      feature: "ask",
      tokensIn: res.usage?.prompt_tokens,
      tokensOut: res.usage?.completion_tokens,
    })

    const msg = res.choices[0]?.message
    if (!msg) return { antwort: "Keine Antwort erhalten.", schritte }

    const calls = msg.tool_calls ?? []
    if (!calls.length) {
      return { antwort: msg.content?.trim() || "Keine Antwort erhalten.", schritte }
    }

    messages.push(msg)

    for (const call of calls) {
      if (call.type !== "function") continue
      const tool = ASK_TOOL_BY_NAME.get(call.function.name)
      let ergebnis: unknown
      if (!tool) {
        ergebnis = { fehler: `Unbekanntes Werkzeug: ${call.function.name}` }
      } else {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.function.arguments || "{}")
        } catch {
          args = {}
        }
        schritte.push({ werkzeug: tool.name, args })
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

  return {
    antwort:
      "Die Frage brauchte zu viele Schritte. Formuliere sie enger, zum Beispiel mit einem konkreten Namen.",
    schritte,
  }
}
