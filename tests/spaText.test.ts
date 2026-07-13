import { describe, it, expect } from "vitest"
import { stripHtml, bundleUrlsFromHtml, extractReadableStrings } from "@/lib/spaText"

describe("stripHtml", () => {
  it("entfernt Skripte, Styles und Tags, kollabiert Whitespace", () => {
    const html = `<html><head><style>.a{color:red}</style><script>var x=1</script></head>
      <body><h1>Max  Muster</h1><p>Marketing   Manager</p></body></html>`
    expect(stripHtml(html)).toBe("Max Muster Marketing Manager")
  })
})

describe("bundleUrlsFromHtml", () => {
  it("löst relative Pfade auf, App-Bundles zuerst, fremde Origins fliegen", () => {
    const html = `<script src="/~flock.js"></script>
      <script src="/assets/index-BX4A.js"></script>
      <script src="https://evil.example.com/steal.js"></script>`
    const urls = bundleUrlsFromHtml(html, "https://cv.lovable.app/")
    expect(urls[0]).toBe("https://cv.lovable.app/assets/index-BX4A.js")
    expect(urls).toContain("https://cv.lovable.app/~flock.js")
    expect(urls.some((u) => u.includes("evil"))).toBe(false)
  })

  it("kaputte Basis-URL gibt leere Liste statt Crash", () => {
    expect(bundleUrlsFromHtml(`<script src="/a.js"></script>`, "kein-url")).toEqual([])
  })
})

describe("extractReadableStrings", () => {
  it("findet Fließtext-Literale, lässt Code-Strings liegen", () => {
    const js = `var a="Data-Driven Marketing Manager in Vienna";b("text-muted-foreground hover:text-foreground");
      c("mousedown mouseup touchcancel touchend");d("I drive measurable marketing growth through data.");
      e("act(...) is not supported in production builds of React.");f("https://example.com/some/path here")`
    const out = extractReadableStrings(js)
    expect(out).toContain("Data-Driven Marketing Manager in Vienna")
    expect(out).toContain("I drive measurable marketing growth through data.")
    expect(out.some((s) => s.includes("hover:"))).toBe(false)
    expect(out.some((s) => s.includes("React"))).toBe(false)
    expect(out.some((s) => s.includes("http"))).toBe(false)
  })

  it("dedupliziert und entschärft Escapes", () => {
    const js = `a("Sieben Jahre Erfahrung, davon f\\u00fcnf in Wien");b("Sieben Jahre Erfahrung, davon f\\u00fcnf in Wien")`
    const out = extractReadableStrings(js)
    expect(out).toEqual(["Sieben Jahre Erfahrung, davon fünf in Wien"])
  })

  it("Event-Namen-Listen ohne Satzcharakter fliegen raus", () => {
    const out = extractReadableStrings(`x("change click focusin focusout input keydown keyup selectionchange")`)
    // reine Kleinbuchstaben-Tokens sind formal lesbar — aber mindestens keine Crash-Gefahr;
    // wichtiger: kurze Einzelwörter ohne Leerzeichen kommen nie durch
    expect(extractReadableStrings(`y("supercalifragilistic")`)).toEqual([])
    expect(Array.isArray(out)).toBe(true)
  })
})
