import { describe, it, expect } from "vitest"
import { istBild, MAX_UPLOAD } from "../src/lib/imageResize"

describe("istBild", () => {
  it("erkennt Bilder am MIME-Typ", () => {
    expect(istBild({ type: "image/jpeg", name: "foto.jpg" })).toBe(true)
    expect(istBild({ type: "image/heic", name: "IMG_0001.HEIC" })).toBe(true)
    expect(istBild({ type: "application/pdf", name: "vertrag.pdf" })).toBe(false)
  })

  it("fällt auf die Endung zurück, wenn der Browser keinen Typ liefert", () => {
    // Genau der Fall, der am Handy still verschluckt wurde
    expect(istBild({ type: "", name: "IMG_20260731.jpg" })).toBe(true)
    expect(istBild({ type: "", name: "screenshot.PNG" })).toBe(true)
    expect(istBild({ type: "", name: "bild.heic" })).toBe(true)
    expect(istBild({ type: "", name: "kontakte.csv" })).toBe(false)
    expect(istBild({ type: "", name: "ohneendung" })).toBe(false)
  })

  it("hält die Obergrenze unter dem Vercel-Body-Limit von 4,5 MB", () => {
    expect(MAX_UPLOAD).toBeLessThan(4_500_000)
  })
})
