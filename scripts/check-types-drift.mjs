// Types-Drift-Check für CI: database.types.ts ist zu 100 % generiert — wer nach
// einer Migration das Regenerieren vergisst, arbeitet mit veralteten Typen und
// merkt es erst zur Laufzeit. Der Check vergleicht die Datei mit dem beim
// letzten Generieren abgelegten Hash (scripts/types.hash) und macht Drift zum
// roten Build. Kein Netz, keine Secrets — läuft überall.
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const TYPES = "src/lib/database.types.ts"
const HASH_FILE = "scripts/types.hash"

const aktuell = createHash("sha256").update(readFileSync(TYPES)).digest("hex")

if (process.argv.includes("--update")) {
  const { writeFileSync } = await import("node:fs")
  writeFileSync(HASH_FILE, aktuell + "\n")
  console.log(`${HASH_FILE} aktualisiert (${aktuell.slice(0, 12)}…)`)
  process.exit(0)
}

let erwartet = ""
try {
  erwartet = readFileSync(HASH_FILE, "utf8").trim()
} catch {
  console.error(
    `${HASH_FILE} fehlt.\n` +
      `Einmalig erzeugen: npm run types:gen (schreibt den Hash mit) — oder,\n` +
      `wenn die Typen nachweislich aktuell sind: node scripts/check-types-drift.mjs --update`
  )
  process.exit(1)
}

if (aktuell !== erwartet) {
  console.error(
    `Types-Drift: ${TYPES} passt nicht zum abgelegten Hash.\n` +
      `Nach einer Migration: npm run types:gen ausführen (regeneriert Datei + Hash)\n` +
      `und beides committen. Wurden die Typen anders regeneriert (z. B. über das\n` +
      `Supabase-MCP), Hash nachziehen: node scripts/check-types-drift.mjs --update`
  )
  process.exit(1)
}
console.log("Types aktuell ✓")
