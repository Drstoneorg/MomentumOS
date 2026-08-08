/**
 * Minimaler CSV-Bauer für den Daten-Export: RFC-4180-Quoting, UTF-8-BOM für
 * Excel, verschachtelte Werte als JSON-String. Pure Funktionen, testbar.
 */

export function csvFeld(wert: unknown): string {
  if (wert === null || wert === undefined) return ""
  const s =
    typeof wert === "object" ? JSON.stringify(wert) : String(wert)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Zeilen (Objekte) zu CSV — Spalten aus den Schlüsseln der ersten Zeile. */
export function zuCsv(zeilen: Record<string, unknown>[]): string {
  if (!zeilen.length) return "﻿"
  const spalten = Object.keys(zeilen[0])
  const kopf = spalten.map(csvFeld).join(",")
  const body = zeilen.map((z) => spalten.map((sp) => csvFeld(z[sp])).join(","))
  return "﻿" + [kopf, ...body].join("\r\n") + "\r\n"
}
