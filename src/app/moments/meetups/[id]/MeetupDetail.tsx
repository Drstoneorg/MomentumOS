"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateMeetup, setMeetupParticipantRsvp, finishMeetup, deleteMeetup } from "@/lib/momentsActions"
import { MEETUP_STATUS_LABELS, RSVP_LABELS, type Tables, type Enums, type Json } from "@/lib/database.types"
import { Card, inputCls, btnCls, btnGhostCls } from "@/components/ui"

type Slot = { when: string; place: string }
const STATUSES: Enums<"meetup_status">[] = ["idea", "proposed", "confirmed", "happened", "cancelled"]
const RSVPS: Enums<"event_invite_status">[] = ["invited", "yes", "no", "no_reply"]

export function MeetupDetail({
  meetup,
  participants,
}: {
  meetup: Tables<"meetups">
  participants: { id: string; rsvp: Enums<"event_invite_status">; contacts: { name: string } | null }[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const slots = (meetup.slots as Json as Slot[]) ?? []
  const [recap, setRecap] = useState(meetup.recap ?? "")

  function addSlot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const when = String(fd.get("when"))
    if (!when) return
    const form = e.currentTarget
    const next = [...slots, { when: new Date(when).toISOString(), place: (fd.get("place") as string) || "" }]
    start(async () => {
      await updateMeetup(meetup.id, { slots: next as unknown as Json, status: meetup.status === "idea" ? "proposed" : meetup.status })
      form.reset()
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">{meetup.title}</h1>
          <select
            value={meetup.status}
            onChange={(e) => start(async () => { await updateMeetup(meetup.id, { status: e.target.value as Enums<"meetup_status">, chosen_slot: meetup.chosen_slot }); router.refresh() })}
            className={inputCls + " ml-auto w-auto"}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{MEETUP_STATUS_LABELS[s]}</option>)}
          </select>
          <button
            onClick={() => confirm("Meetup löschen?") && start(async () => { await deleteMeetup(meetup.id); router.push("/moments/meetups") })}
            className="text-zinc-600 hover:text-red-400"
          >
            Löschen
          </button>
        </div>
        {meetup.notes && <p className="mt-2 text-sm text-zinc-300">{meetup.notes}</p>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Terminvorschläge (Slot A/B/C)">
          <ul className="mb-3 space-y-2">
            {slots.map((s, i) => (
              <li key={i} className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${meetup.chosen_slot === i ? "border-rose-600 bg-rose-950/20" : "border-zinc-800"}`}>
                <span className="font-medium text-zinc-500">{String.fromCharCode(65 + i)}</span>
                <div className="flex-1">
                  <p className="text-zinc-200">{new Date(s.when).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</p>
                  {s.place && <p className="text-xs text-zinc-500">{s.place}</p>}
                </div>
                <button
                  onClick={() => start(async () => { await updateMeetup(meetup.id, { chosen_slot: i, status: "confirmed" }); router.refresh() })}
                  className={btnGhostCls}
                >
                  {meetup.chosen_slot === i ? "✓ gewählt" : "wählen"}
                </button>
              </li>
            ))}
            {!slots.length && <li className="text-sm text-zinc-500">Noch keine Vorschläge.</li>}
          </ul>
          <form onSubmit={addSlot} className="space-y-2">
            <input name="when" type="datetime-local" required className={inputCls} />
            <div className="flex gap-2">
              <input name="place" placeholder="Ort" className={inputCls} />
              <button type="submit" disabled={pending} className={btnCls}>+</button>
            </div>
          </form>
          {meetup.chosen_slot != null && slots[meetup.chosen_slot] && (
            <a
              href={`/api/moments/meetups/${meetup.id}/ics`}
              className="mt-2 inline-block text-xs text-rose-400 hover:underline"
            >
              📅 Kalender-Datei (.ics) — Reminder 1 Tag vorher
            </a>
          )}
        </Card>

        <Card title="Teilnehmer">
          <ul className="space-y-2">
            {participants.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <span className="text-zinc-200">{p.contacts?.name}</span>
                <select
                  value={p.rsvp}
                  onChange={(e) => start(async () => { await setMeetupParticipantRsvp(p.id, meetup.id, e.target.value as Enums<"event_invite_status">); router.refresh() })}
                  className={inputCls + " ml-auto w-auto text-xs"}
                >
                  {RSVPS.map((r) => <option key={r} value={r}>{RSVP_LABELS[r]}</option>)}
                </select>
              </li>
            ))}
            {!participants.length && <li className="text-sm text-zinc-500">Keine Teilnehmer.</li>}
          </ul>
        </Card>
      </div>

      <Card title="Nachbereitung">
        <p className="mb-2 text-sm text-zinc-400">
          „Wie war's" — landet als Gedächtnis-Eintrag bei allen Teilnehmern und schließt das Meetup ab.
        </p>
        <textarea value={recap} onChange={(e) => setRecap(e.target.value)} rows={3} placeholder="Kurze Notiz zum Treffen…" className={inputCls} />
        <button
          onClick={() => start(async () => { await finishMeetup(meetup.id, recap); router.refresh() })}
          disabled={pending || !recap.trim()}
          className={btnCls + " mt-2"}
        >
          Abschließen & ins Gedächtnis
        </button>
      </Card>
    </div>
  )
}
