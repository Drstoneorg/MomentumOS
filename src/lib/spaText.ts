// SPA-Text-Fallback: Client-gerenderte Seiten (React/Vite, z.B. Lovable) liefern
// eine fast leere HTML-Hülle — die sichtbaren Texte stecken als String-Literale
// im JS-Bundle. Diese Helfer holen sie da raus (best effort, Heuristik).

/** HTML zu grobem Fließtext strippen (Skripte/Styles/Tags raus). */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Same-Origin-JS-Bundles aus dem HTML ziehen (App-Bundles unter /assets/ zuerst). */
export function bundleUrlsFromHtml(html: string, baseUrl: string): string[] {
  const origin = (() => {
    try {
      return new URL(baseUrl).origin
    } catch {
      return null
    }
  })()
  if (!origin) return []
  const urls: string[] = []
  for (const m of html.matchAll(/src="([^"]+\.js)"/g)) {
    try {
      const u = new URL(m[1], baseUrl)
      if (u.origin === origin && !urls.includes(u.href)) urls.push(u.href)
    } catch {
      // kaputte URL ignorieren
    }
  }
  return urls.sort((a, b) => Number(b.includes("/assets/")) - Number(a.includes("/assets/"))).slice(0, 3)
}

/**
 * Lesbare Sätze aus minifiziertem JS fischen: doppelt-gequotete String-Literale,
 * Code-artiges (CSS-Klassen, Event-Namen, React-Fehlertexte) fliegt per Heuristik raus.
 */
export function extractReadableStrings(js: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of js.matchAll(/"((?:[^"\\\n]|\\.){12,400})"/g)) {
    let s: string
    try {
      s = JSON.parse(`"${m[1]}"`) as string
    } catch {
      continue
    }
    s = s.trim()
    // Code-Indikatoren: Klammern, Operatoren, CSS/React-Vokabular, URLs
    if (/[{}<>;=`|]|function|return|http|className|svg|hover:|text-|bg-|flex|rgb|React|render/.test(s)) continue
    if (!s.includes(" ")) continue
    const letters = [...s].filter((c) => /[a-zA-ZäöüÄÖÜßáéíóúñçżłśź]/.test(c) || c === " ").length
    if (letters / s.length <= 0.82) continue
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}
