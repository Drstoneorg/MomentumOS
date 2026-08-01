/**
 * Kontakterfassung aus einem Link. Eingabe ist eine URL, Ausgabe ist Text, den
 * die bestehende Freitext-Extraktion lesen kann — plus der Kanal, unter dem die
 * Person erreichbar ist.
 *
 * Wichtig und bewusst so gebaut: LinkedIn, Instagram und TikTok liefern ohne
 * Login keine Profildaten aus, sondern eine Anmeldeschranke. Deshalb ist der
 * Weg zweistufig — was die Seite hergibt, wird genutzt; was sie verweigert,
 * wird aus der URL selbst abgeleitet (Kanal, Handle, Namensvorschlag aus dem
 * Slug). Ein Kontakt entsteht in beiden Fällen, nur unterschiedlich vollständig.
 */

export type UrlProfil = {
  url: string
  channel: string
  handle: string
  /** Aus dem Adress-Slug abgeleiteter Name — nur ein Vorschlag, nie eine Tatsache. */
  nameVorschlag: string | null
  plattform: string
}

/** Erste http(s)-Adresse in einem Text. */
export function findeUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"')]+/i)
  if (m) return m[0].replace(/[.,;:]+$/, "")
  // Ohne Schema, aber mit erkennbarem Host: linkedin.com/in/max
  const bare = text
    .trim()
    .match(/^((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/[^\s]*)$/i)
  return bare ? `https://${bare[1]}` : null
}

/** Nur öffentliche http(s)-Ziele. Schützt vor Zugriffen ins interne Netz. */
export function urlErlaubt(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false
  const host = u.hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false
  if (host === "metadata.google.internal") return false
  // IPv4-Literale in privaten Bereichen und alles ohne Punkt (interne Namen)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split(".").map(Number)
    if (a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
      return false
    }
  }
  if (host.startsWith("[") || host.includes(":")) return false // IPv6-Literale
  if (!host.includes(".")) return false
  return true
}

/** "max-mustermann-1a2b3c" → "Max Mustermann". Zahlen-/Hash-Anhänge fliegen raus. */
export function slugZuName(slug: string): string | null {
  const teile = decodeURIComponent(slug)
    .split(/[-_.]/)
    .filter((t) => t && !/^\d+$/.test(t) && !/^[0-9a-f]{6,}$/i.test(t))
  if (!teile.length) return null
  const name = teile
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
    .join(" ")
    .trim()
  return name.length >= 2 ? name : null
}

const HOSTS: { test: RegExp; channel: string; plattform: string; pfad?: RegExp }[] = [
  { test: /(^|\.)linkedin\.com$/, channel: "linkedin", plattform: "LinkedIn", pfad: /^\/in\/([^/?#]+)/ },
  { test: /(^|\.)xing\.com$/, channel: "xing", plattform: "Xing", pfad: /^\/profile\/([^/?#]+)/ },
  { test: /(^|\.)github\.com$/, channel: "github", plattform: "GitHub", pfad: /^\/([^/?#]+)/ },
  { test: /(^|\.)instagram\.com$/, channel: "instagram", plattform: "Instagram", pfad: /^\/([^/?#]+)/ },
  { test: /(^|\.)tiktok\.com$/, channel: "tiktok", plattform: "TikTok", pfad: /^\/@([^/?#]+)/ },
  { test: /(^|\.)t\.me$/, channel: "telegram", plattform: "Telegram", pfad: /^\/([^/?#]+)/ },
]

/** Kanal, Handle und Namensvorschlag aus der Adresse allein. */
export function profilAusUrl(raw: string): UrlProfil | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "")
  for (const h of HOSTS) {
    if (!h.test.test(host)) continue
    const m = h.pfad ? u.pathname.match(h.pfad) : null
    const handle = m?.[1] ?? ""
    if (!handle) break
    return {
      url: u.toString(),
      channel: h.channel,
      handle,
      nameVorschlag: slugZuName(handle),
      plattform: h.plattform,
    }
  }
  return {
    url: u.toString(),
    channel: "website",
    handle: u.toString(),
    nameVorschlag: null,
    plattform: host,
  }
}

/** Sieht die Antwort nach Anmeldeschranke statt Profil aus? */
export function istAnmeldeschranke(status: number, text: string): boolean {
  if (status === 999 || status === 401 || status === 403 || status === 429) return true
  const t = text.toLowerCase()
  const marker = [
    "sign in to continue",
    "melde dich an, um",
    "log in to continue",
    "authwall",
    "please log in",
    "anmelden, um fortzufahren",
    "you must log in to continue",
  ]
  // Kurze Seite plus Login-Marker: Profilseiten sind deutlich länger.
  return marker.some((m) => t.includes(m)) && text.length < 20_000
}

/**
 * HTML auf lesbaren Text eindampfen. Titel, Meta-Beschreibung und
 * og:-Angaben kommen zuerst — dort steht bei Profilseiten das Wesentliche.
 */
export function textAusHtml(html: string, maxLen = 6000): string {
  const teile: string[] = []
  const meta = (name: string) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      "i"
    )
    const m = html.match(re)
    return m?.[1]?.trim() || null
  }
  const titel = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()
  if (titel) teile.push(`Titel: ${titel}`)
  for (const [label, key] of [
    ["og:title", "og:title"],
    ["Beschreibung", "description"],
    ["og:description", "og:description"],
    ["Vorname", "profile:first_name"],
    ["Nachname", "profile:last_name"],
  ] as const) {
    const v = meta(key)
    if (v) teile.push(`${label}: ${v}`)
  }

  // JSON-LD: bei sauber ausgezeichneten Seiten steht die Person hier drin
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    const roh = m[1].trim().slice(0, 4000)
    if (/"@type"\s*:\s*"(Person|Organization|ProfilePage)"/i.test(roh)) teile.push(`Strukturiert: ${roh}`)
  }

  const koerper = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
  if (koerper) teile.push(`Seitentext: ${koerper}`)

  return teile.join("\n").slice(0, maxLen)
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
const MAX_HTML = 900_000

export type SeitenErgebnis =
  | { ok: true; text: string }
  | { ok: false; grund: "gesperrt" | "fehler"; info: string }

/** Seite laden, mit Zeitlimit und Größendeckel. Wirft nie. */
export async function holeSeite(url: string, timeoutMs = 12_000): Promise<SeitenErgebnis> {
  if (!urlErlaubt(url)) return { ok: false, grund: "fehler", info: "Adresse nicht erlaubt" }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "de,en" },
    })
    const typ = res.headers.get("content-type") ?? ""
    if (!typ.includes("html") && !typ.includes("text/plain")) {
      return { ok: false, grund: "fehler", info: `Kein Text-Inhalt (${typ || "unbekannt"})` }
    }
    const html = (await res.text()).slice(0, MAX_HTML)
    if (istAnmeldeschranke(res.status, html)) {
      return { ok: false, grund: "gesperrt", info: `HTTP ${res.status}` }
    }
    if (!res.ok) return { ok: false, grund: "fehler", info: `HTTP ${res.status}` }
    const text = textAusHtml(html)
    if (text.length < 40) return { ok: false, grund: "gesperrt", info: "Seite liefert keinen Text" }
    return { ok: true, text }
  } catch (e) {
    const info = e instanceof Error ? e.message : "unbekannt"
    return { ok: false, grund: "fehler", info: info.includes("abort") ? "Zeitüberschreitung" : info }
  } finally {
    clearTimeout(timer)
  }
}
