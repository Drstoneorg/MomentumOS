// Client-seitige Parser für vCard (.vcf) und CSV — kein Upload, Datei bleibt im Browser.
import type { ImportRow } from "@/lib/actions"

function unfoldVcf(text: string) {
  // RFC 6350: Zeilen, die mit Space/Tab beginnen, gehören zur Vorzeile
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "")
}

function vcfValue(line: string) {
  const idx = line.indexOf(":")
  return idx >= 0 ? line.slice(idx + 1).trim() : ""
}

export function parseVcf(text: string): ImportRow[] {
  const rows: ImportRow[] = []
  const cards = unfoldVcf(text).split(/BEGIN:VCARD/i).slice(1)
  for (const card of cards) {
    const lines = card.split(/\r?\n/)
    const row: ImportRow = { name: "" }
    for (const line of lines) {
      const upper = line.toUpperCase()
      if (upper.startsWith("FN")) row.name = vcfValue(line)
      else if (upper.startsWith("N:") || upper.startsWith("N;")) {
        if (!row.name) {
          const [last, first] = vcfValue(line).split(";")
          row.name = [first, last].filter(Boolean).join(" ")
        }
      } else if (upper.startsWith("TEL") && !row.phone) row.phone = vcfValue(line)
      else if (upper.startsWith("EMAIL") && !row.email) row.email = vcfValue(line)
      else if (upper.startsWith("BDAY")) {
        const v = vcfValue(line).replace(/[^0-9-]/g, "")
        // 19900315 oder 1990-03-15; --0315 (ohne Jahr) → 1900 als Platzhalter überspringen
        const m = v.match(/^(\d{4})-?(\d{2})-?(\d{2})$/)
        if (m) row.birthday = `${m[1]}-${m[2]}-${m[3]}`
      } else if (upper.startsWith("ADR") && !row.location) {
        // ADR: PO;ext;street;city;region;plz;country
        const parts = vcfValue(line).split(";")
        row.location = parts[3] || parts[5] || parts[6] || undefined
      } else if (upper.startsWith("NOTE") && !row.notes) row.notes = vcfValue(line)
      else if (upper.startsWith("CATEGORIES")) row.tags = vcfValue(line).split(",").map((t) => t.trim()).filter(Boolean)
    }
    if (row.name) rows.push(row)
  }
  return rows
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQ = false
      else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === sep) { out.push(cur); cur = "" }
    else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

const HEADER_MAP: Record<string, keyof ImportRow> = {
  name: "name", "full name": "name", "vorname nachname": "name", kontakt: "name",
  phone: "phone", telefon: "phone", tel: "phone", handy: "phone", mobile: "phone", "phone 1 - value": "phone",
  email: "email", "e-mail": "email", mail: "email", "e-mail 1 - value": "email",
  birthday: "birthday", geburtstag: "birthday", bday: "birthday",
  location: "location", ort: "location", stadt: "location", city: "location",
  notes: "notes", notizen: "notes", note: "notes",
}

export function parseCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ","
  const headers = splitCsvLine(lines[0], sep).map((h) => h.toLowerCase())
  const cols: (keyof ImportRow | "tags" | null)[] = headers.map((h) =>
    h === "tags" ? "tags" : HEADER_MAP[h] ?? null
  )
  // Google-CSV: First Name / Last Name getrennt
  const firstIdx = headers.findIndex((h) => h === "first name" || h === "given name" || h === "vorname")
  const lastIdx = headers.findIndex((h) => h === "last name" || h === "family name" || h === "nachname")

  const rows: ImportRow[] = []
  for (const line of lines.slice(1)) {
    const vals = splitCsvLine(line, sep)
    const row: ImportRow = { name: "" }
    cols.forEach((key, i) => {
      const v = vals[i]
      if (!key || !v) return
      if (key === "tags") row.tags = v.split(/[,;|]/).map((t) => t.trim()).filter(Boolean)
      else if (key === "birthday") {
        const m = v.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/) // dd.mm.yyyy
        row.birthday = m
          ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
          : v.match(/^\d{4}-\d{2}-\d{2}$/) ? v : undefined
      } else row[key] = v
    })
    if (!row.name && (firstIdx >= 0 || lastIdx >= 0)) {
      row.name = [vals[firstIdx], vals[lastIdx]].filter(Boolean).join(" ")
    }
    if (row.name) rows.push(row)
  }
  return rows
}

export function parseContactFile(filename: string, text: string): ImportRow[] {
  return filename.toLowerCase().endsWith(".vcf") || /BEGIN:VCARD/i.test(text)
    ? parseVcf(text)
    : parseCsv(text)
}
