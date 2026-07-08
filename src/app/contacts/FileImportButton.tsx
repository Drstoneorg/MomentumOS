"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { bulkImportContacts, type ImportRow, type ImportResult } from "@/lib/actions"
import { parseContactFile } from "@/lib/importParse"
import { btnCls, btnGhostCls } from "@/components/ui"

export function FileImportButton() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [selected, setSelected] = useState<boolean[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [pending, start] = useTransition()

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const parsed = parseContactFile(file.name, text)
    setRows(parsed)
    setSelected(parsed.map(() => true))
    setResult(null)
    e.target.value = ""
  }

  function submit() {
    if (!rows) return
    const chosen = rows.filter((_, i) => selected[i])
    start(async () => {
      const res = await bulkImportContacts(chosen)
      setResult(res)
      setRows(null)
      router.refresh()
    })
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".vcf,.csv,text/vcard,text/csv"
        onChange={onFile}
        className="hidden"
      />
      <button onClick={() => fileRef.current?.click()} className={btnGhostCls}>
        📇 vCard/CSV
      </button>

      {rows && (
        <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10">
          <div className="w-full max-w-2xl space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold">Import-Vorschau ({rows.length} Kontakte)</h2>
            {rows.length === 0 ? (
              <p className="text-sm text-amber-400">
                Nichts erkannt. Erwartet: .vcf (Handy-Export) oder CSV mit Kopfzeile
                (name, telefon, email, geburtstag, ort, tags, notizen).
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-zinc-800">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-zinc-950 text-left text-zinc-400">
                    <tr>
                      <th className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={selected.every(Boolean)}
                          onChange={(e) => setSelected(rows.map(() => e.target.checked))}
                        />
                      </th>
                      <th className="px-2 py-1.5">Name</th>
                      <th className="px-2 py-1.5">Telefon</th>
                      <th className="px-2 py-1.5">E-Mail</th>
                      <th className="px-2 py-1.5">Geburtstag</th>
                      <th className="px-2 py-1.5">Ort</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-zinc-800">
                        <td className="px-2 py-1">
                          <input
                            type="checkbox"
                            checked={selected[i]}
                            onChange={(e) =>
                              setSelected((s) => s.map((v, j) => (j === i ? e.target.checked : v)))
                            }
                          />
                        </td>
                        <td className="px-2 py-1 text-zinc-200">{r.name}</td>
                        <td className="px-2 py-1 text-zinc-400">{r.phone ?? "—"}</td>
                        <td className="px-2 py-1 text-zinc-400">{r.email ?? "—"}</td>
                        <td className="px-2 py-1 text-zinc-400">{r.birthday ?? "—"}</td>
                        <td className="px-2 py-1 text-zinc-400">{r.location ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-zinc-500">
              Duplikate (gleicher Name oder gleiches Handle) werden automatisch übersprungen.
              Import als Plattform „freund“, Telefon → SMS-Kanal, E-Mail → E-Mail-Kanal.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRows(null)} className="px-3 py-1.5 text-sm text-zinc-400">
                Abbrechen
              </button>
              <button
                onClick={submit}
                disabled={pending || rows.length === 0 || !selected.some(Boolean)}
                className={btnCls}
              >
                {pending ? "Importiere…" : `${selected.filter(Boolean).length} importieren`}
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold">Import fertig</h2>
            <p className="text-sm text-emerald-400">✓ {result.created} Kontakte angelegt</p>
            {result.skipped.length > 0 && (
              <div className="max-h-48 overflow-y-auto text-sm text-zinc-400">
                <p className="mb-1 text-amber-400">Übersprungen ({result.skipped.length}):</p>
                <ul className="space-y-0.5 text-xs">
                  {result.skipped.map((s, i) => (
                    <li key={i}>{s.name} — {s.reason}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setResult(null)} className={btnCls}>OK</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
