import { chatJSON } from "./deepseek"
import { contextToPrompt, type ContactContext } from "./context"
import { PIPELINE_STAGES, type Enums } from "@/lib/database.types"

export type StageAnalysis = {
  stage: Enums<"pipeline_stage">
  next_step: string
  followup_in_days: number | null
  followup_reason: string | null
  date_idea: string | null
}

export async function analyzeStage(
  ctx: ContactContext
): Promise<StageAnalysis> {
  const system = `Du ordnest ein Dating-Gespräch in eine Pipeline ein und planst Follow-ups.
Stages: ${PIPELINE_STAGES.join(", ")}
Antworte als JSON:
{
  "stage": "eine der Stages",
  "next_step": "konkreter nächster Schritt in einem Satz",
  "followup_in_days": 2,
  "followup_reason": "warum dann nachfassen, oder null wenn kein Follow-up nötig",
  "date_idea": "passende Date-Idee basierend auf Interessen, oder null"
}
followup_in_days: null wenn Antwort der Person aussteht und noch frisch ist.`

  const raw = await chatJSON(system, contextToPrompt(ctx))
  const parsed = JSON.parse(raw) as StageAnalysis
  if (!PIPELINE_STAGES.includes(parsed.stage)) {
    parsed.stage = ctx.contact.pipeline_stage
  }
  return parsed
}
