import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { publishEventToShrine, shrineKonfiguriert } from "@/lib/shrinePublish"

describe("shrinePublish", () => {
  it("ohne Key gilt die Anbindung als nicht konfiguriert", () => {
    // In Tests ist der Shrine-Key nie gesetzt
    expect(shrineKonfiguriert()).toBe(false)
  })

  it("Titel unter 3 Zeichen wird abgelehnt, bevor irgendwas rausgeht", async () => {
    await expect(
      publishEventToShrine(
        { title: "ab", description: null, location: null, starts_at: "2026-09-01T20:00:00Z", ticket_url: null },
        "profil-id",
        null
      )
    ).rejects.toThrow(/Titel/)
  })

  it("kein Cron veröffentlicht auf Shrine — Publishing bleibt ein Klick des Users", () => {
    const cronDir = join(process.cwd(), "src/app/api/cron")
    const dateien: string[] = []
    const sammle = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) sammle(p)
        else dateien.push(p)
      }
    }
    sammle(cronDir)
    for (const datei of dateien) {
      const quelle = readFileSync(datei, "utf8")
      expect(quelle, `${datei} darf nicht auf Shrine schreiben`).not.toMatch(
        /shrinePublish|publishToShrine|shrine_events/
      )
    }
  })
})
