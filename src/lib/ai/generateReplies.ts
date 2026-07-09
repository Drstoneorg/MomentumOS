import { chatJSON } from "./deepseek"
import { contextToPrompt, timeContext, type ContactContext } from "./context"
import { stripDashes } from "@/lib/text"

export { stripDashes }

export type ReplyVariants = {
  variants: Record<string, string>
  next_step: string
  next_step_reason: string
  social_read: string
  cjk?: {
    original: string
    translation: string
    tone: string
    reading: string
    culture_note: string
  } | null
}

// "höflich" entfernt — hat nie gefallen (User-Feedback 2026-07)
const STYLES = ["locker", "charmant", "direkt", "witzig", "flirty"]

export async function generateReplies(
  ctx: ContactContext,
  situation: string,
  nowLocal?: string
): Promise<ReplyVariants> {
  const lang = (ctx.contact.language ?? "de").toLowerCase()
  const isCJK = ["ja", "jp", "zh", "cn", "japanisch", "chinesisch"].some((l) =>
    lang.startsWith(l)
  )

  const system = `Du bist mein persönlicher Dating-Assistent. Du schreibst Nachrichten in MEINEM Stil.

## MEIN STIL (exakt nachahmen — Wortwahl, Länge, Groß-/Kleinschreibung, Emoji-Verhalten aus den Beispielen übernehmen)
${ctx.styleProfile}

## HARTE REGELN (gelten IMMER, brechen niemals — wichtiger als alles andere)
${ctx.styleRules}

${timeContext(nowLocal)}

Ziel des Gesamtgesprächs: ein echtes Treffen vereinbaren — aber nie aufdringlich. Lies soziale Signale: kurze Antworten, langsames Antworten oder Ausweichen bedeuten zurückhaltender sein. Grenzen respektieren. Kulturelle Unterschiede beachten.

Antworte als JSON:
{
  "variants": { ${STYLES.map((s) => `"${s}": "..."`).join(", ")} },
  "next_step": "smalltalk|gegenfrage|interesse_aufbauen|plattformwechsel|date_vorschlagen|abwarten|archivieren",
  "next_step_reason": "kurze Begründung",
  "social_read": "1-2 Sätze: wie wirkt die Person gerade, worauf achten"${
    isCJK
      ? `,
  "cjk": { "original": "Nachricht in Zielsprache", "translation": "deutsche Übersetzung", "tone": "Tonalität", "reading": "Umschrift (Romaji/Pinyin)", "culture_note": "kultureller Hinweis" }`
      : ""
  }
}
Jede Variante: eine echte Chat-Nachricht, passend zur Situation, nicht generisch.`

  const user = `${contextToPrompt(ctx)}

## Situation / Auftrag
${situation || "Schreibe die passende nächste Nachricht."}`

  const raw = await chatJSON(system, user, "replies")
  const parsed = JSON.parse(raw) as ReplyVariants
  // Harte Regel deterministisch durchsetzen — Prompt allein reicht bei LLMs nicht.
  for (const [k, v] of Object.entries(parsed.variants ?? {})) {
    parsed.variants[k] = stripDashes(v)
  }
  return { cjk: null, ...parsed }
}

