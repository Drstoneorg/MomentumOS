import OpenAI from "openai"

export function deepseek() {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY fehlt — in .env.local eintragen")
  }
  return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" })
}

export async function chatJSON(system: string, user: string): Promise<string> {
  const client = deepseek()
  const res = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 1.1,
  })
  return res.choices[0]?.message?.content ?? "{}"
}
