"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateFriendMeta, logContact } from "@/lib/momentsActions"
import { connectionScore, scoreColor, daysUntilBirthday } from "@/lib/moments"
import type { Tables } from "@/lib/database.types"
import { Card, inputCls, btnCls, btnGhostCls } from "@/components/ui"

const TAG_PRESETS = ["enger Freundeskreis", "Bekannte", "Familie", "Community", "Convention"]

export function FriendsPanel({ contact }: { contact: Tables<"contacts"> }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [edit, setEdit] = useState(false)
  const { score, daysSince, overdue } = connectionScore(contact)
  const bday = daysUntilBirthday(contact.birthday)

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      await updateFriendMeta(contact.id, {
        birthday: (fd.get("birthday") as string) || null,
        contact_frequency_days: fd.get("freq") ? Number(fd.get("freq")) : null,
        relationship_tags: fd.getAll("tags").map(String),
      })
      setEdit(false)
      router.refresh()
    })
  }

  return (
    <Card title="Freundschaft">
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Verbindung:</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div className={`h-full ${scoreColor(score)}`} style={{ width: `${score}%` }} />
          </div>
          <span className={overdue ? "text-rose-400" : "text-zinc-400"}>
            {daysSince == null ? "nie" : `${daysSince}d`}
          </span>
        </div>
        {overdue && (
          <p className="text-xs text-rose-400">
            Kontaktpause — Zeit, dich mal zu melden.
          </p>
        )}
        <p className="text-zinc-400">
          Geburtstag:{" "}
          {contact.birthday
            ? `${new Date(contact.birthday).toLocaleDateString("de-DE", { day: "2-digit", month: "long" })}${
                bday != null ? (bday === 0 ? " — heute! 🎂" : ` — in ${bday} Tagen`) : ""
              }`
            : "—"}
        </p>
        {(contact.relationship_tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {contact.relationship_tags.map((t) => (
              <span key={t} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => start(async () => { await logContact(contact.id, "me"); router.refresh() })}
            disabled={pending}
            className={btnGhostCls}
          >
            ✓ Habe mich gemeldet
          </button>
          <button onClick={() => setEdit(!edit)} className={btnGhostCls}>
            {edit ? "Schließen" : "Bearbeiten"}
          </button>
        </div>

        {edit && (
          <form onSubmit={save} className="space-y-2 pt-2">
            <label className="block text-xs text-zinc-500">Geburtstag</label>
            <input type="date" name="birthday" defaultValue={contact.birthday ?? ""} className={inputCls} />
            <label className="block text-xs text-zinc-500">Melde-Rhythmus (Tage)</label>
            <input type="number" name="freq" defaultValue={contact.contact_frequency_days ?? ""} placeholder="z.B. 42" className={inputCls} />
            <label className="block text-xs text-zinc-500">Beziehungsgruppen</label>
            <div className="flex flex-wrap gap-2">
              {TAG_PRESETS.map((t) => (
                <label key={t} className="flex items-center gap-1 text-xs text-zinc-300">
                  <input type="checkbox" name="tags" value={t} defaultChecked={contact.relationship_tags?.includes(t)} />
                  {t}
                </label>
              ))}
            </div>
            <button type="submit" disabled={pending} className={btnCls}>Speichern</button>
          </form>
        )}
      </div>
    </Card>
  )
}
