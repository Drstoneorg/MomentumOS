import { describe, it, expect } from "vitest"
import {
  findeUrl,
  urlErlaubt,
  slugZuName,
  profilAusUrl,
  istAnmeldeschranke,
  textAusHtml,
} from "../src/lib/urlCapture"

describe("findeUrl", () => {
  it("findet Adressen mit und ohne Schema", () => {
    expect(findeUrl("schau mal https://www.linkedin.com/in/max-mustermann/ an")).toBe(
      "https://www.linkedin.com/in/max-mustermann/"
    )
    expect(findeUrl("linkedin.com/in/max-mustermann")).toBe("https://linkedin.com/in/max-mustermann")
  })

  it("schneidet Satzzeichen am Ende ab", () => {
    expect(findeUrl("hier: https://example.org/max.")).toBe("https://example.org/max")
  })

  it("liefert null bei reinem Text", () => {
    expect(findeUrl("Anna Huber, 0660 1234567")).toBeNull()
    expect(findeUrl("kein link hier")).toBeNull()
  })
})

describe("urlErlaubt", () => {
  it("lässt öffentliche http(s)-Adressen zu", () => {
    expect(urlErlaubt("https://www.linkedin.com/in/max")).toBe(true)
    expect(urlErlaubt("http://example.org")).toBe(true)
  })

  it("blockt internes Netz und fremde Schemata", () => {
    for (const böse of [
      "http://localhost:3000/geheim",
      "http://127.0.0.1/",
      "http://10.0.0.5/",
      "http://192.168.0.1/",
      "http://172.16.3.4/",
      "http://169.254.169.254/latest/meta-data/",
      "http://metadata.google.internal/",
      "file:///etc/passwd",
      "ftp://example.org/",
      "http://intern/",
    ]) {
      expect(urlErlaubt(böse), böse).toBe(false)
    }
  })
})

describe("slugZuName", () => {
  it("macht aus einem Profil-Slug einen Namen", () => {
    expect(slugZuName("max-mustermann")).toBe("Max Mustermann")
    expect(slugZuName("anna.huber")).toBe("Anna Huber")
  })

  it("wirft Zahlen- und Hash-Anhänge raus", () => {
    expect(slugZuName("max-mustermann-1a2b3c4d")).toBe("Max Mustermann")
    expect(slugZuName("max-mustermann-847293")).toBe("Max Mustermann")
  })

  it("liefert null, wenn nichts Brauchbares übrig bleibt", () => {
    expect(slugZuName("1234567")).toBeNull()
    expect(slugZuName("")).toBeNull()
  })
})

describe("profilAusUrl", () => {
  it("erkennt LinkedIn und leitet den Namen ab", () => {
    const p = profilAusUrl("https://www.linkedin.com/in/max-mustermann-1a2b3c/")!
    expect(p.channel).toBe("linkedin")
    expect(p.handle).toBe("max-mustermann-1a2b3c")
    expect(p.nameVorschlag).toBe("Max Mustermann")
    expect(p.plattform).toBe("LinkedIn")
  })

  it("erkennt die übrigen Plattformen", () => {
    expect(profilAusUrl("https://github.com/torvalds")?.channel).toBe("github")
    expect(profilAusUrl("https://www.tiktok.com/@someone")?.handle).toBe("someone")
    expect(profilAusUrl("https://instagram.com/someone/")?.channel).toBe("instagram")
    expect(profilAusUrl("https://t.me/someone")?.channel).toBe("telegram")
    expect(profilAusUrl("https://www.xing.com/profile/Max_Mustermann")?.channel).toBe("xing")
  })

  it("fällt bei allem anderen auf website zurück", () => {
    const p = profilAusUrl("https://maxmustermann.at/ueber-mich")!
    expect(p.channel).toBe("website")
    expect(p.nameVorschlag).toBeNull()
  })

  it("liefert null bei Unfug", () => {
    expect(profilAusUrl("kein link")).toBeNull()
  })
})

describe("istAnmeldeschranke", () => {
  it("erkennt Sperr-Statuscodes", () => {
    expect(istAnmeldeschranke(999, "")).toBe(true)
    expect(istAnmeldeschranke(403, "")).toBe(true)
    expect(istAnmeldeschranke(429, "")).toBe(true)
  })

  it("erkennt kurze Login-Seiten am Text", () => {
    expect(istAnmeldeschranke(200, "<html>Please log in to continue</html>")).toBe(true)
    expect(istAnmeldeschranke(200, "<html>authwall</html>")).toBe(true)
  })

  it("hält eine lange echte Seite nicht für eine Schranke", () => {
    const lang = "Max Mustermann, Senior Developer bei Beispiel GmbH. ".repeat(600)
    expect(istAnmeldeschranke(200, lang + "please log in")).toBe(false)
    expect(istAnmeldeschranke(200, lang)).toBe(false)
  })
})

describe("textAusHtml", () => {
  const html = `<html><head><title>Max Mustermann | Developer</title>
    <meta name="description" content="Entwickler aus Wien">
    <meta property="og:title" content="Max Mustermann">
    <script>var x = "unsichtbar"</script>
    <style>.a{color:red}</style>
    </head><body><h1>Max&nbsp;Mustermann</h1><p>max@example.org</p></body></html>`

  it("zieht Titel, Meta-Angaben und Fließtext heraus", () => {
    const t = textAusHtml(html)
    expect(t).toContain("Titel: Max Mustermann | Developer")
    expect(t).toContain("Beschreibung: Entwickler aus Wien")
    expect(t).toContain("og:title: Max Mustermann")
    expect(t).toContain("max@example.org")
  })

  it("wirft Skripte und Stile raus", () => {
    const t = textAusHtml(html)
    expect(t).not.toContain("unsichtbar")
    expect(t).not.toContain("color:red")
  })

  it("nimmt strukturierte Personendaten mit", () => {
    const mitLd = `<html><body><script type="application/ld+json">{"@type":"Person","name":"Anna Huber"}</script></body></html>`
    expect(textAusHtml(mitLd)).toContain("Anna Huber")
  })

  it("deckelt die Länge", () => {
    expect(textAusHtml(`<body>${"x".repeat(50_000)}</body>`, 500)).toHaveLength(500)
  })
})
