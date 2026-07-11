/**
 * Stellt ein Backup aus /api/backup in die Supabase-DB zurück (Upsert per id).
 *
 *   node scripts/restore-backup.mjs pfad/zu/backup.json
 *
 * Braucht in .env.local: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Überschreibt bestehende Zeilen mit gleicher id, löscht aber nichts —
 * für einen sauberen Voll-Restore vorher Tabellen leeren (siehe BACKUP.md).
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { config } from "dotenv"

config({ path: ".env.local" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen in .env.local")
  process.exit(1)
}
const file = process.argv[2]
if (!file) {
  console.error("Aufruf: node scripts/restore-backup.mjs backup.json")
  process.exit(1)
}

// FK-sichere Reihenfolge: Eltern vor Kindern.
const ORDER = [
  "settings",
  "contacts",
  "contact_channels",
  "messages",
  "memories",
  "conversation_summaries",
  "suggestions",
  "followups",
  "dates",
  "events",
  "event_invites",
  "meetups",
  "meetup_participants",
  "occasions",
  "card_templates",
  "moment_assets",
  "asset_sends",
  "reply_feedback",
  "ai_usage",
  "providers",
  "treatments",
  "bookings",
  "booking_offers",
  "reviews",
  "job_applications",
  "push_subscriptions",
]

const supabase = createClient(url, key, { auth: { persistSession: false } })
const dump = JSON.parse(readFileSync(file, "utf8"))
const tables = dump.tables ?? dump

// settings nutzt key als Primärschlüssel, alle anderen id
const conflictKey = (table) => (table === "settings" ? "key" : "id")

let total = 0
for (const table of ORDER) {
  const rows = tables[table]
  if (!rows?.length) continue
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: conflictKey(table) })
    if (error) {
      console.error(`${table}: ${error.message}`)
      process.exit(1)
    }
  }
  total += rows.length
  console.log(`${table}: ${rows.length} Zeilen`)
}
console.log(`Fertig — ${total} Zeilen wiederhergestellt`)
