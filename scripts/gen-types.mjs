// Generiert src/lib/database.types.ts aus dem Live-Schema — ersetzt das
// fehleranfällige Handpatchen nach Migrationen. Die Datei ist seitdem zu 100 %
// generiert; eigene Labels leben in src/lib/dbLabels.ts.
//
// Braucht SUPABASE_ACCESS_TOKEN (persönlicher Token, supabase.com/dashboard/account/tokens)
// in der Umgebung oder in .env.local.
import { readFileSync, writeFileSync } from "node:fs"

const PROJECT_REF = "ddxfegugjxsyhvntnqpn"
const OUT = "src/lib/database.types.ts"

let token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  try {
    const env = readFileSync(".env.local", "utf8")
    token = env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)?.[1]?.trim()
  } catch {
    /* keine .env.local */
  }
}
if (!token) {
  console.error(
    "SUPABASE_ACCESS_TOKEN fehlt.\n" +
      "Token anlegen: https://supabase.com/dashboard/account/tokens\n" +
      "Dann in .env.local eintragen: SUPABASE_ACCESS_TOKEN=sbp_…"
  )
  process.exit(1)
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/types/typescript`,
  { headers: { Authorization: `Bearer ${token}` } }
)
if (!res.ok) {
  console.error(`Supabase-API antwortet ${res.status}: ${(await res.text()).slice(0, 300)}`)
  process.exit(1)
}
const { types } = await res.json()
if (typeof types !== "string" || !types.includes("export type Database")) {
  console.error("Antwort enthält keine Typen — Format geändert?")
  process.exit(1)
}
writeFileSync(OUT, types.endsWith("\n") ? types : types + "\n")
console.log(`${OUT} neu generiert (${types.length} Zeichen)`)

// Hash für den CI-Drift-Check mitschreiben (scripts/check-types-drift.mjs)
const { createHash } = await import("node:crypto")
writeFileSync(
  "scripts/types.hash",
  createHash("sha256").update(readFileSync(OUT)).digest("hex") + "\n"
)
console.log("scripts/types.hash aktualisiert")
