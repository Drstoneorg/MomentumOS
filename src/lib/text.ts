// Reine Text-Helfer, client- und serverseitig nutzbar (keine Server-Imports).

// Alle Unicode-Strichzeichen, die ein LLM ausgeben kann: Bindestrich-Minus,
// Hyphen, Non-Breaking-Hyphen, Figure-/En-/Em-Dash, Horizontal Bar, Hyphen-Bullet,
// Minus, Two-/Three-Em-Dash, Small/Fullwidth-Hyphen.
const DASH_CHARS =
  "-\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015\\u2043\\u2212\\u2E3A\\u2E3B\\uFE58\\uFE63\\uFF0D"
const DASH_SPACED = new RegExp(`\\s+[${DASH_CHARS}]\\s+`, "g")
const DASH_ANY = new RegExp(`[${DASH_CHARS}]`, "g")

/**
 * Entfernt alle Binde-/Gedankenstriche aus einer Nachricht (Nutzer-Regel: nie Striche).
 * Satzzeichen-Striche werden zu Komma, Wort-Striche zu Leerzeichen verschmolzen.
 */
export function stripDashes(text: string): string {
  return text
    .replace(DASH_SPACED, ", ") // " - " als Satzzeichen
    .replace(DASH_ANY, " ") // in Wörtern und Rest: Leerzeichen ("Kaffee-Date" -> "Kaffee Date")
    .replace(/\s{2,}/g, " ")
    .trim()
}
