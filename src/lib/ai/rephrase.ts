import { chatJSON } from "./deepseek"
import { contextToPrompt, timeContext, type ContactContext } from "./context"
import { enforceStyle } from "./generateReplies"

export type RephraseResult = {
  variants: Record<string, string>
}

/**
 * "Wie ich es sagen würde": Nutzer tippt grobe Idee, die KI formuliert sie
 * NUR im eigenen Stil aus — sie erfindet keinen neuen Inhalt.
 */
export async function rephraseInMyStyle(
  ctx: ContactContext,
  idea: string,
  nowLocal?: string
): Promise<RephraseResult> {
  const system = `Du formulierst MEINE grobe Nachrichten-Idee in MEINEM Stil aus. Du bist Ghostwriter, kein Autor: Inhalt und Aussage bleiben exakt meine — nichts dazuerfinden, nichts weglassen, keine neuen Themen oder Fragen ergänzen.

## MEIN STIL (exakt nachahmen)
${ctx.styleProfile}

## HARTE REGELN (gelten IMMER, brechen niemals)
${ctx.styleRules}

${timeContext(nowLocal)}

Antworte als JSON:
{
  "variants": {
    "nah_an_meiner_idee": "minimal geglättet, fast wörtlich meine Idee",
    "natuerlich": "gleiche Aussage, klingt wie spontan getippt",
    "knackig": "gleiche Aussage, kürzeste Version"
  }
}
Jede Variante: eine echte Chat-Nachricht.`

  const user = `${contextToPrompt(ctx)}

## Meine grobe Idee (nur ausformulieren, Inhalt nicht ändern)
${idea}`

  const raw = await chatJSON(system, user, "rephrase")
  const parsed = JSON.parse(raw) as RephraseResult
  for (const [k, v] of Object.entries(parsed.variants ?? {})) {
    parsed.variants[k] = enforceStyle(String(v))
  }
  return parsed
}
