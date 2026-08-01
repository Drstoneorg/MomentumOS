"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Enums, Tables } from "@/lib/database.types"
import {
  createGig,
  deleteArtist,
  deleteGig,
  generateGigInquiry,
  updateArtist,
  updateArtistList,
  updateGig,
} from "@/lib/artistActions"
import {
  ARTIST_TYPE_LABELS,
  GIG_STATUS_COLOR,
  GIG_STATUS_LABELS,
  formatEuro,
  gigStaleDays,
  parseFeeInput,
} from "@/lib/artists"
import { GigQuickActions } from "../GigQuickActions"
import { Card, btnCls, btnGhostCls, inputCls } from "@/components/ui"
import { InlineField } from "@/components/InlineField"

type Artist = Tables<"artists">
type Gig = Tables<"gigs"> & {
  events: { title: string; starts_at: string | null; location: string | null } | null
}
type EventOption = { id: string; title: string; starts_at: string | null }

export function ArtistDetail({
  artist,
  gigs,
  events,
}: {
  artist: Artist
  gigs: Gig[]
  events: EventOption[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const save = (patch: Parameters<typeof updateArtist>[1]) =>
    updateArtist(artist.id, patch)

  return (
    <div className="space-y-4">
      {/* Kopf: Name, Typ, Rating, aktiv */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">
          🎧{" "}
          <InlineField value={artist.name} onSave={(v) => save({ name: v || artist.name })} />
        </h1>
        <select
          value={artist.artist_type}
          onChange={(e) =>
            start(() => save({ artist_type: e.target.value as Enums<"artist_type"> }))
          }
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
        >
          {Object.entries(ARTIST_TYPE_LABELS).map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
        <span className="text-lg" title="Bewertung (Klick; gleicher Stern = löschen)">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => start(() => save({ rating: artist.rating === n ? null : n }))}
              className={n <= (artist.rating ?? 0) ? "text-amber-400" : "text-zinc-700"}
            >
              ★
            </button>
          ))}
        </span>
        <label className="ml-auto flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={artist.active}
            onChange={(e) => start(() => save({ active: e.target.checked }))}
          />
          aktiv
        </label>
        <button
          onClick={() => {
            if (confirm(`${artist.name} samt allen Gigs löschen?`)) {
              start(async () => {
                await deleteArtist(artist.id)
                router.push("/book/artists")
              })
            }
          }}
          className="text-sm text-zinc-600 hover:text-rose-400"
        >
          Löschen
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Profil">
          <dl className="space-y-2 text-sm">
            <Row label="Genres">
              <InlineField
                value={artist.genres.join(", ")}
                placeholder="kommagetrennt"
                onSave={(v) => updateArtistList(artist.id, "genres", v)}
              />
            </Row>
            <Row label="Stadt">
              <InlineField value={artist.city ?? ""} onSave={(v) => save({ city: v || null })} />
            </Row>
            <Row label="Zielpublikum">
              <InlineField
                value={artist.audience ?? ""}
                placeholder="wen zieht der Act? z. B. Goth-Crowd, 20–30"
                onSave={(v) => save({ audience: v || null })}
              />
            </Row>
            <Row label="Gage von">
              <InlineField
                value={artist.fee_min_cents ? formatEuro(artist.fee_min_cents) : ""}
                placeholder="z.B. 300"
                onSave={(v) => save({ fee_min_cents: parseFeeInput(v) })}
              />
            </Row>
            <Row label="Gage bis">
              <InlineField
                value={artist.fee_max_cents ? formatEuro(artist.fee_max_cents) : ""}
                placeholder="z.B. 500"
                onSave={(v) => save({ fee_max_cents: parseFeeInput(v) })}
              />
            </Row>
            <Row label="Links">
              <InlineField
                value={artist.links.join(", ")}
                placeholder="SoundCloud, Instagram … kommagetrennt"
                display={
                  artist.links.length ? (
                    <span className="space-x-2">
                      {artist.links.map((l) => (
                        <a
                          key={l}
                          href={l.startsWith("http") ? l : `https://${l}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-sky-400 hover:underline"
                        >
                          {l.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                        </a>
                      ))}
                    </span>
                  ) : undefined
                }
                onSave={(v) => updateArtistList(artist.id, "links", v)}
              />
            </Row>
          </dl>
        </Card>

        <Card title="Kontakt & Rider">
          <dl className="space-y-2 text-sm">
            <Row label="Ansprechperson">
              <InlineField
                value={artist.contact_name ?? ""}
                onSave={(v) => save({ contact_name: v || null })}
              />
            </Row>
            <Row label="E-Mail">
              <InlineField
                value={artist.contact_email ?? ""}
                onSave={(v) => save({ contact_email: v || null })}
              />
            </Row>
            <Row label="Telefon">
              <InlineField
                value={artist.contact_phone ?? ""}
                onSave={(v) => save({ contact_phone: v || null })}
              />
            </Row>
            <Row label="Tech-Rider">
              <InlineField
                multiline
                value={artist.tech_rider ?? ""}
                onSave={(v) => save({ tech_rider: v || null })}
              />
            </Row>
            <Row label="Hospitality">
              <InlineField
                multiline
                value={artist.hospitality ?? ""}
                onSave={(v) => save({ hospitality: v || null })}
              />
            </Row>
            <Row label="Notizen">
              <InlineField
                multiline
                value={artist.notes ?? ""}
                onSave={(v) => save({ notes: v || null })}
              />
            </Row>
          </dl>
        </Card>
      </div>

      <Card title={`Gigs (${gigs.length})`}>
        <div className="space-y-3">
          {gigs.map((g) => (
            <GigRow key={g.id} gig={g} artist={artist} />
          ))}
          {gigs.length === 0 && (
            <p className="text-sm text-zinc-500">Noch kein Gig — unten anlegen</p>
          )}
        </div>
      </Card>

      <NewGigForm artistId={artist.id} events={events} pending={pending} />
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-zinc-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-zinc-200">{children}</dd>
    </div>
  )
}

function GigRow({ gig, artist }: { gig: Gig; artist: Artist }) {
  const [wishes, setWishes] = useState("")
  const [msg, setMsg] = useState("")
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()
  const staleDays = gigStaleDays(gig.status, gig.status_changed_at)

  function generate(overrideWishes?: string) {
    setMsg("")
    start(async () => {
      const res = await generateGigInquiry(gig.id, overrideWishes ?? wishes)
      if (res.error) setMsg(res.error)
    })
  }

  // Follow-up bei unbeantworteter Anfrage: kurzer Erinnerungs-Entwurf
  function generateReminder() {
    generate(
      `Kurze freundliche Erinnerung: die Anfrage ist seit ${staleDays} Tagen unbeantwortet. Bezug auf die vorherige Nachricht, kein Vorwurf, maximal 60 Wörter`,
    )
  }

  async function copy() {
    if (!gig.inquiry_draft) return
    await navigator.clipboard.writeText(gig.inquiry_draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // mailto = Entwurf im eigenen Mailprogramm — gesendet wird manuell
  function mailtoHref(): string | null {
    if (!artist.contact_email || !gig.inquiry_draft) return null
    const m = gig.inquiry_draft.match(/^Betreff: (.+)\n\n([\s\S]*)$/)
    const subject = m?.[1] ?? "Booking-Anfrage"
    const body = m?.[2] ?? gig.inquiry_draft
    return `mailto:${artist.contact_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const finished = gig.status === "played" || gig.status === "cancelled"

  return (
    <div className={`rounded-xl border border-zinc-800 p-3 ${finished ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-white">
          {gig.title ?? gig.events?.title ?? "Gig"}
        </span>
        <span className="text-zinc-500">
          {gig.venue ?? gig.events?.location ?? ""}
          {gig.gig_date
            ? ` · ${new Date(`${gig.gig_date}T12:00:00`).toLocaleDateString("de-DE")}`
            : ""}
        </span>
        <span className="text-zinc-400">
          Slot:{" "}
          <InlineField
            value={gig.set_slot ?? ""}
            placeholder="23–01 Uhr"
            onSave={(v) => updateGig(gig.id, gig.artist_id, { set_slot: v || null })}
          />
        </span>
        <span className="text-zinc-400">
          Gage:{" "}
          <InlineField
            value={gig.fee_cents ? formatEuro(gig.fee_cents) : ""}
            placeholder="—"
            onSave={(v) => updateGig(gig.id, gig.artist_id, { fee_cents: parseFeeInput(v) })}
          />
        </span>
        {staleDays != null && (
          <span className="rounded-full bg-amber-950/60 px-2 py-0.5 text-xs text-amber-300">
            ⏰ {staleDays}d ohne Antwort
          </span>
        )}
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-xs ${GIG_STATUS_COLOR[gig.status]}`}
        >
          {GIG_STATUS_LABELS[gig.status]}
        </span>
        <GigQuickActions gigId={gig.id} artistId={gig.artist_id} status={gig.status} />
        {gig.status === "cancelled" && (
          <button
            onClick={() => start(() => deleteGig(gig.id, gig.artist_id))}
            className="text-xs text-zinc-600 hover:text-rose-400"
          >
            entfernen
          </button>
        )}
      </div>

      {!finished && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              value={wishes}
              onChange={(e) => setWishes(e.target.value)}
              placeholder="Wünsche für den Anfrage-Text (optional)"
              className={`${inputCls} min-w-40 flex-1`}
            />
            <button onClick={() => generate()} disabled={pending} className={btnGhostCls}>
              {pending ? "…" : gig.inquiry_draft ? "📨 Neu entwerfen" : "📨 Anfrage entwerfen"}
            </button>
            {staleDays != null && (
              <button
                onClick={generateReminder}
                disabled={pending}
                className="rounded-lg border border-amber-800 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-950/40 disabled:opacity-50"
                title="Kurzen Erinnerungs-Entwurf zur unbeantworteten Anfrage generieren"
              >
                ⏰ Erinnerung entwerfen
              </button>
            )}
            {(gig.status === "confirmed" || gig.status === "contracted" || gig.status === "played") && (
              <a
                href={`/book/gigs/${gig.id}/contract`}
                className={btnGhostCls}
                title="Druckfertiger Booking-Vertrag (PDF über Drucken-Dialog)"
              >
                📄 Vertrag
              </a>
            )}
          </div>
          {msg && <p className="text-sm text-rose-400">{msg}</p>}
          {gig.inquiry_draft && (
            <div className="space-y-2">
              <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                {gig.inquiry_draft}
              </pre>
              <div className="flex gap-2">
                <button onClick={copy} className={btnGhostCls}>
                  {copied ? "✔ Kopiert" : "Kopieren"}
                </button>
                {mailtoHref() && (
                  <a href={mailtoHref()!} className={btnGhostCls}>
                    ✉️ Im Mailprogramm öffnen
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NewGigForm({
  artistId,
  events,
  pending: parentPending,
}: {
  artistId: string
  events: EventOption[]
  pending: boolean
}) {
  const [msg, setMsg] = useState("")
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setMsg("")
    start(async () => {
      const res = await createGig({
        artistId,
        eventId: (fd.get("event_id") as string) || null,
        title: (fd.get("title") as string) || "",
        venue: (fd.get("venue") as string) || "",
        gigDate: (fd.get("gig_date") as string) || null,
        setSlot: (fd.get("set_slot") as string) || "",
        feeCents: parseFeeInput((fd.get("fee") as string) || ""),
        notes: (fd.get("notes") as string) || "",
      })
      if (res.error) setMsg(res.error)
      else form.reset()
    })
  }

  return (
    <Card title="Neuer Gig">
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2">
        <select name="event_id" className={inputCls} defaultValue="">
          <option value="">— ohne MomentOS-Event —</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title}
              {ev.starts_at ? ` (${new Date(ev.starts_at).toLocaleDateString("de-DE")})` : ""}
            </option>
          ))}
        </select>
        <input name="title" placeholder="Titel (falls kein Event, z.B. Clubnacht XY)" className={inputCls} />
        <input name="venue" placeholder="Venue" className={inputCls} />
        <input name="gig_date" type="date" className={inputCls} />
        <input name="set_slot" placeholder="Set-Slot (z.B. 23–01 Uhr)" className={inputCls} />
        <input name="fee" placeholder="Gage in € (z.B. 350)" className={inputCls} />
        <textarea name="notes" placeholder="Notizen (Deal-Details, Ansage …)" rows={2} className={`${inputCls} sm:col-span-2`} />
        {msg && <p className="text-sm text-rose-400 sm:col-span-2">{msg}</p>}
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending || parentPending} className={btnCls}>
            {pending ? "…" : "Gig anlegen"}
          </button>
        </div>
      </form>
    </Card>
  )
}
