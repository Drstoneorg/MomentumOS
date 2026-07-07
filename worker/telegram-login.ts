/**
 * Einmaliges Telegram-Login. Erzeugt Session-String für .env.local.
 * Voraussetzung: TELEGRAM_API_ID + TELEGRAM_API_HASH von https://my.telegram.org/apps
 *
 *   npm run telegram:login
 */
import { TelegramClient } from "telegram"
import { StringSession } from "telegram/sessions"
import * as readline from "readline/promises"
import { config } from "dotenv"

config({ path: ".env.local" })

const apiId = Number(process.env.TELEGRAM_API_ID)
const apiHash = process.env.TELEGRAM_API_HASH ?? ""

async function main() {
  if (!apiId || !apiHash) {
    console.error("TELEGRAM_API_ID und TELEGRAM_API_HASH in .env.local eintragen (https://my.telegram.org/apps)")
    process.exit(1)
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  })
  await client.start({
    phoneNumber: () => rl.question("Telefonnummer (+49…): "),
    password: () => rl.question("2FA-Passwort (falls gesetzt): "),
    phoneCode: () => rl.question("Code aus Telegram: "),
    onError: (err) => console.error(err),
  })
  console.log("\nLogin erfolgreich. Diese Zeile in .env.local eintragen:\n")
  console.log(`TELEGRAM_SESSION=${client.session.save()}`)
  await client.disconnect()
  rl.close()
  process.exit(0)
}

main()
