"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateContact, deleteContact, setContactRealm, setContactIntent } from "@/lib/actions"
import { PIPELINE_STAGES, STAGE_LABELS, INTENT_LABELS } from "@/lib/dbLabels"
import type { Tables } from "@/lib/database.types"
import { inputCls, btnGhostCls, PriorityDot } from "@/components/ui"
import { InlineField } from "@/components/InlineField"
import { AvatarUpload } from "./AvatarUpload"

export function ContactHeader({ contact }: { contact: Tables<"contacts"> }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [analyzing, setAnalyzing] = useState(false)
  const [edit, setEdit] = useState(false)

  async function runAnalysis() {
    setAnalyzing(true)
    const res = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: contact.id }),
    })
    setAnalyzing(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Fehler" }))
      alert(`KI-Analyse fehlgeschlagen: ${error}`)
      return
    }
    router.refresh()
  }

  function saveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      await updateContact(contact.id, {
        name: String(fd.get("name")),
        age: fd.get("age") ? Number(fd.get("age")) : null,
        location: (fd.get("location") as string) || null,
        language: (fd.get("language") as string) || "de",
        bio: (fd.get("bio") as string) || null,
        notes: (fd.get("notes") as string) || null,
        interests: String(fd.get("interests") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      })
      setEdit(false)
      router.refresh()
    })
  }

  const isMoment = contact.realm === "moment"

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <AvatarUpload contactId={contact.id} name={contact.name} url={contact.avatar_url} />
        <PriorityDot priority={contact.priority} />
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            isMoment ? "border-amber-700 text-amber-300" : "border-rose-700 text-rose-300"
          }`}
          title={isMoment ? "MomentOS-Kontakt (Freunde & echte Bekannte)" : "MatchOS-Kontakt (Match/Anbahnung)"}
        >
          {isMoment ? "MomentOS" : "Match"}
        </span>
        <h1 className="text-xl font-bold">
          <InlineField
            value={contact.name}
            onSave={async (v) => {
              await updateContact(contact.id, { name: v.trim() || contact.name })
              router.refresh()
            }}
          />
          <span className="ml-2 text-zinc-500">
            <InlineField
              value={contact.age ? String(contact.age) : ""}
              placeholder="Alter?"
              type="number"
              className="w-16"
              onSave={async (v) => {
                await updateContact(contact.id, { age: v ? Number(v) : null })
                router.refresh()
              }}
            />
          </span>
        </h1>
        <span className="text-sm text-zinc-400">
          {contact.platform} ·{" "}
          <InlineField
            value={contact.location ?? ""}
            placeholder="Ort?"
            onSave={async (v) => {
              await updateContact(contact.id, { location: v.trim() || null })
              router.refresh()
            }}
          />{" "}
          · {contact.language}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!isMoment && (
          <select
            value={contact.intent}
            onChange={(e) =>
              start(async () => {
                await setContactIntent(contact.id, e.target.value as "date" | "event_lead" | "both")
                router.refresh()
              })
            }
            className={inputCls + " w-auto"}
            title="Spur: echtes Kennenlernen (Date), Gast für meine Events (Event-Lead) oder beides"
          >
            {Object.entries(INTENT_LABELS).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          )}
          {!isMoment && (
          <select
            value={contact.pipeline_stage}
            onChange={(e) =>
              start(async () => {
                await updateContact(contact.id, {
                  pipeline_stage: e.target.value as Tables<"contacts">["pipeline_stage"],
                })
                router.refresh()
              })
            }
            className={inputCls + " w-auto"}
          >
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
          </select>
          )}
          <select
            value={contact.priority}
            onChange={(e) =>
              start(async () => {
                await updateContact(contact.id, {
                  priority: e.target.value as Tables<"contacts">["priority"],
                })
                router.refresh()
              })
            }
            className={inputCls + " w-auto"}
          >
            <option value="low">Prio: niedrig</option>
            <option value="normal">Prio: normal</option>
            <option value="high">Prio: hoch</option>
          </select>
          {!isMoment && (
          <button
            onClick={() =>
              start(async () => {
                if (
                  !contact.auto_mode &&
                  !confirm(
                    "Autopilot: Bei eingehenden Telegram-Nachrichten entsteht automatisch ein Entwurf, der nach 10 Minuten Veto-Frist automatisch gesendet wird (Stil: locker). Du wirst per Telegram benachrichtigt und kannst in der Queue stoppen. Aktivieren?"
                  )
                )
                  return
                await updateContact(contact.id, { auto_mode: !contact.auto_mode })
                router.refresh()
              })
            }
            className={
              contact.auto_mode
                ? "rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
                : btnGhostCls
            }
            title="Telegram-Autopilot mit 10-Minuten-Veto"
          >
            {contact.auto_mode ? "⚡ Autopilot AN" : "Autopilot"}
          </button>
          )}
          {!isMoment && (
          <button onClick={runAnalysis} disabled={analyzing} className={btnGhostCls}>
            {analyzing ? "Analysiere…" : "KI-Analyse"}
          </button>
          )}
          <button
            onClick={() =>
              start(async () => {
                await setContactRealm(contact.id, isMoment ? "match" : "moment")
                router.refresh()
              })
            }
            disabled={pending}
            className={btnGhostCls}
            title={
              isMoment
                ? "Kontakt zurück in die Matchbox (MatchOS) verschieben"
                : "Aus einem Match ist ein echter Kontakt geworden — zu MomentOS verschieben"
            }
          >
            {isMoment ? "→ Matchbox" : "→ MomentOS"}
          </button>
          <button onClick={() => setEdit(!edit)} className={btnGhostCls}>
            {edit ? "Schließen" : "Bearbeiten"}
          </button>
          <button
            onClick={() => {
              if (confirm(`${contact.name} wirklich löschen? Alle Daten gehen verloren.`)) {
                start(async () => {
                  await deleteContact(contact.id)
                  router.push("/contacts")
                })
              }
            }}
            className="rounded-lg px-2 py-1.5 text-sm text-zinc-600 hover:text-red-400"
          >
            Löschen
          </button>
        </div>
      </div>

      {!edit && (
        <p className="mt-2 text-sm text-zinc-400">
          <InlineField
            value={contact.bio ?? ""}
            placeholder="Bio hinzufügen …"
            multiline
            onSave={async (v) => {
              await updateContact(contact.id, { bio: v.trim() || null })
              router.refresh()
            }}
          />
        </p>
      )}
      {!edit && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="text-xs text-zinc-500">
            <InlineField
              value={(contact.interests ?? []).join(", ")}
              placeholder="+ Interessen"
              className="w-56"
              display={
                (contact.interests?.length ?? 0) > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {contact.interests!.map((i) => (
                      <span key={i} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                        {i}
                      </span>
                    ))}
                  </span>
                ) : undefined
              }
              onSave={async (v) => {
                await updateContact(contact.id, {
                  interests: v.split(",").map((s) => s.trim()).filter(Boolean),
                })
                router.refresh()
              }}
            />
          </span>
        </div>
      )}
      {!edit && (
        <p className="mt-1 text-xs text-zinc-500">
          Notizen:{" "}
          <InlineField
            value={contact.notes ?? ""}
            placeholder="hinzufügen …"
            multiline
            onSave={async (v) => {
              await updateContact(contact.id, { notes: v.trim() || null })
              router.refresh()
            }}
          />
        </p>
      )}
      {!edit && (
        <p className="mt-1 text-xs text-zinc-500">
          🎚 Ton für diesen Kontakt:{" "}
          <InlineField
            value={contact.tone_offset ?? ""}
            placeholder="z.B. frecher, mehr Emojis, förmlicher …"
            onSave={async (v) => {
              await updateContact(contact.id, { tone_offset: v.trim() || null })
              router.refresh()
            }}
          />
        </p>
      )}

      {edit && (
        <form onSubmit={saveEdit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input name="name" defaultValue={contact.name} className={inputCls} />
          <div className="flex gap-3">
            <input name="age" type="number" defaultValue={contact.age ?? ""} placeholder="Alter" className={inputCls} />
            <input name="location" defaultValue={contact.location ?? ""} placeholder="Ort" className={inputCls} />
          </div>
          <select name="language" defaultValue={contact.language ?? "de"} className={inputCls}>
            <option value="de">Deutsch</option>
            <option value="en">Englisch</option>
            <option value="ja">Japanisch</option>
            <option value="zh">Chinesisch</option>
          </select>
          <input
            name="interests"
            defaultValue={(contact.interests ?? []).join(", ")}
            placeholder="Interessen, kommagetrennt"
            className={inputCls}
          />
          <textarea name="bio" defaultValue={contact.bio ?? ""} placeholder="Bio" rows={2} className={inputCls + " sm:col-span-2"} />
          <textarea name="notes" defaultValue={contact.notes ?? ""} placeholder="Notizen (Fotos, Details …)" rows={2} className={inputCls + " sm:col-span-2"} />
          <button type="submit" disabled={pending} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500 sm:col-span-2">
            Speichern
          </button>
        </form>
      )}
    </div>
  )
}
