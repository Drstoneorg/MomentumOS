"use client"

import { useState } from "react"

/**
 * Zusage/Absage-Formular der öffentlichen Einladungs-Seite. Antwort ist
 * jederzeit über denselben Link änderbar — der Zustand kommt vom Server,
 * hier wird nur optimistisch nachgezogen. Zweisprachig (DE/EN, Vorauswahl
 * aus der Kontakt-Sprache), Warteliste bei vollem Event, nach dem Event
 * wird die Seite zur 1-Frage-Feedback-Karte.
 */

const T = {
  de: {
    ja: "Bin dabei 🖤",
    nein: "Diesmal nicht",
    warteliste: "Auf die Warteliste",
    vollHinweis: "Das Event ist voll — du kannst dich auf die Warteliste setzen, wir melden uns sobald ein Platz frei wird",
    aufWarteliste: "Du stehst auf der Warteliste ⏳ sobald ein Platz frei wird, bekommst du Bescheid",
    begleitung: "Begleitung",
    wenBringstDuMit: "Wen bringst du mit? (Namen für die Türliste)",
    kommentar: "Kommentar (optional)",
    speichern: "Speichern",
    gespeichert: "Gespeichert 🖤 du kannst deine Antwort über diesen Link jederzeit ändern",
    fehlerAllg: "Das hat nicht geklappt, bitte nochmal",
    fehlerNetz: "Keine Verbindung, bitte nochmal versuchen",
    ticketFinal: "Du hast schon ein Ticket 🎟",
    warDa: "Du warst dabei 🖤",
    nurBegleitung: "unten kannst du nur noch deine Begleitung anpassen",
    kalender: "📅 In Kalender eintragen",
    qrZeigen: "🎫 Einlass-QR zeigen",
    qrHinweis: "Zeig den Code am Einlass — geht schneller als der Name auf der Liste",
    feedbackTitel: "Wie war's?",
    feedbackHinweis: "1 Frage, 10 Sekunden — hilft mir fürs nächste Mal",
    feedbackKommentar: "Magst du noch was dazu sagen? (optional)",
    feedbackSenden: "Abschicken",
    feedbackDanke: "Danke dir 🖤",
    wenigerBegleitung: "eine Begleitung weniger",
    mehrBegleitung: "eine Begleitung mehr",
  },
  en: {
    ja: "I'm in 🖤",
    nein: "Not this time",
    warteliste: "Join the waitlist",
    vollHinweis: "The event is full — join the waitlist and you'll hear from me as soon as a spot opens up",
    aufWarteliste: "You're on the waitlist ⏳ I'll let you know as soon as a spot opens up",
    begleitung: "Plus ones",
    wenBringstDuMit: "Who are you bringing? (names for the door list)",
    kommentar: "Comment (optional)",
    speichern: "Save",
    gespeichert: "Saved 🖤 you can change your answer via this link anytime",
    fehlerAllg: "That didn't work, please try again",
    fehlerNetz: "No connection, please try again",
    ticketFinal: "You already have a ticket 🎟",
    warDa: "You were there 🖤",
    nurBegleitung: "below you can still adjust your plus ones",
    kalender: "📅 Add to calendar",
    qrZeigen: "🎫 Show entry QR",
    qrHinweis: "Show this code at the door — faster than finding your name on the list",
    feedbackTitel: "How was it?",
    feedbackHinweis: "1 question, 10 seconds — helps me for next time",
    feedbackKommentar: "Anything to add? (optional)",
    feedbackSenden: "Send",
    feedbackDanke: "Thank you 🖤",
    wenigerBegleitung: "one plus one less",
    mehrBegleitung: "one plus one more",
  },
} as const

type Lang = keyof typeof T

export function RsvpForm({
  token,
  status,
  plusOnes,
  statusFinal,
  voll,
  vergangen,
  companionNames,
  comment,
  feedbackRating,
  startLang,
  qrDataUrl,
}: {
  token: string
  status: string
  plusOnes: number
  statusFinal: boolean
  voll: boolean
  vergangen: boolean
  companionNames: string | null
  comment: string | null
  feedbackRating: number | null
  startLang: Lang
  qrDataUrl: string | null
}) {
  const [lang, setLang] = useState<Lang>(startLang)
  const [aktuell, setAktuell] = useState(status)
  const [begleitung, setBegleitung] = useState(plusOnes)
  const [namen, setNamen] = useState(companionNames ?? "")
  const [kommentar, setKommentar] = useState(comment ?? "")
  const [rating, setRating] = useState<number | null>(feedbackRating)
  const [fbKommentar, setFbKommentar] = useState("")
  const [fbGesendet, setFbGesendet] = useState(feedbackRating != null)
  const [qrOffen, setQrOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [gespeichert, setGespeichert] = useState(false)
  const t = T[lang]

  async function senden(
    antwort: "ja" | "nein" | "warteliste" | "feedback",
    extra: Record<string, unknown> = {}
  ) {
    setLaeuft(true)
    setFehler(null)
    setGespeichert(false)
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          antwort,
          companion_names: namen,
          comment: kommentar,
          ...extra,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        status?: string
        voll?: boolean
        feedback?: number
        error?: string
      }
      if (!res.ok || !data.ok) {
        setFehler(data.error || t.fehlerAllg)
        return false
      }
      if (antwort === "feedback") {
        setFbGesendet(true)
      } else {
        setAktuell(data.status ?? antwort)
        if (data.status === "yes") setBegleitung(typeof extra.plus_ones === "number" ? (extra.plus_ones as number) : begleitung)
        if (data.status === "no" || data.status === "waitlist") setBegleitung(0)
      }
      setGespeichert(true)
      return true
    } catch {
      setFehler(t.fehlerNetz)
      return false
    } finally {
      setLaeuft(false)
    }
  }

  const zugesagt = ["yes", "ticket", "attended"].includes(aktuell)
  const abgesagt = aktuell === "no"
  const wartend = aktuell === "waitlist"

  const langSchalter = (
    <div className="flex justify-end gap-1 text-xs">
      {(["de", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded px-2 py-0.5 uppercase ${
            lang === l ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )

  // ---- Nach dem Event: 1-Frage-Feedback statt RSVP ----
  if (vergangen && (zugesagt || statusFinal)) {
    return (
      <div className="space-y-4">
        {langSchalter}
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
          <p className="text-base font-semibold text-white">{t.feedbackTitel}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{t.feedbackHinweis}</p>
          {fbGesendet ? (
            <p className="mt-3 text-sm text-emerald-400">
              {t.feedbackDanke}
              {rating ? ` (${rating}/5)` : ""}
            </p>
          ) : (
            <>
              <div className="mt-3 flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    aria-label={`${n} von 5`}
                    className={`h-11 w-11 rounded-xl border text-lg transition ${
                      rating != null && n <= rating
                        ? "border-fuchsia-500 bg-fuchsia-950/40 text-fuchsia-200"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
                    }`}
                  >
                    {rating != null && n <= rating ? "★" : "☆"}
                  </button>
                ))}
              </div>
              <textarea
                value={fbKommentar}
                onChange={(e) => setFbKommentar(e.target.value)}
                placeholder={t.feedbackKommentar}
                rows={2}
                className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
              />
              <button
                onClick={() => rating && senden("feedback", { rating, comment: fbKommentar })}
                disabled={laeuft || !rating}
                className="mt-2 w-full rounded-xl bg-fuchsia-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {t.feedbackSenden}
              </button>
            </>
          )}
          {fehler && <p className="mt-2 text-sm text-red-400">{fehler}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {langSchalter}

      {statusFinal ? (
        <p className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-3 text-sm text-emerald-200">
          {aktuell === "attended" ? t.warDa : t.ticketFinal} — {t.nurBegleitung}
        </p>
      ) : wartend ? (
        <p className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-3 text-sm text-amber-200">
          {t.aufWarteliste}
        </p>
      ) : (
        <>
          {voll && !zugesagt && (
            <p className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-3 text-xs text-amber-200">
              {t.vollHinweis}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() =>
                voll && !zugesagt ? senden("warteliste") : senden("ja", { plus_ones: begleitung })
              }
              disabled={laeuft}
              className={`rounded-xl px-4 py-3 text-base font-semibold transition ${
                zugesagt
                  ? "bg-emerald-600 text-white"
                  : "border border-zinc-600 text-zinc-200 hover:border-emerald-500 hover:text-emerald-300"
              }`}
            >
              {voll && !zugesagt ? t.warteliste : t.ja}
            </button>
            <button
              onClick={() => senden("nein")}
              disabled={laeuft}
              className={`rounded-xl px-4 py-3 text-base font-semibold transition ${
                abgesagt ? "bg-zinc-700 text-white" : "border border-zinc-600 text-zinc-200 hover:border-zinc-400"
              }`}
            >
              {t.nein}
            </button>
          </div>
        </>
      )}

      {(zugesagt || statusFinal) && (
        <>
          <div className="flex items-center justify-between rounded-xl border border-zinc-700 px-4 py-3">
            <span className="text-sm text-zinc-300">
              {t.begleitung} (+{begleitung})
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => senden("ja", { plus_ones: Math.max(0, begleitung - 1) })}
                disabled={laeuft || begleitung === 0}
                className="h-9 w-9 rounded-full border border-zinc-600 text-lg text-zinc-200 disabled:opacity-30"
                aria-label={t.wenigerBegleitung}
              >
                −
              </button>
              <span className="w-4 text-center font-semibold text-white">{begleitung}</span>
              <button
                onClick={() => senden("ja", { plus_ones: Math.min(3, begleitung + 1) })}
                disabled={laeuft || begleitung >= 3}
                className="h-9 w-9 rounded-full border border-zinc-600 text-lg text-zinc-200 disabled:opacity-30"
                aria-label={t.mehrBegleitung}
              >
                +
              </button>
            </div>
          </div>

          {begleitung > 0 && (
            <input
              value={namen}
              onChange={(e) => setNamen(e.target.value)}
              onBlur={() => namen !== (companionNames ?? "") && senden("ja", { plus_ones: begleitung })}
              placeholder={t.wenBringstDuMit}
              maxLength={160}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
            />
          )}

          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/rsvp/ics?token=${token}`}
              className="rounded-xl border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-400"
              download
            >
              {t.kalender}
            </a>
            {qrDataUrl && (
              <button
                onClick={() => setQrOffen((v) => !v)}
                className="rounded-xl border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-400"
              >
                {t.qrZeigen}
              </button>
            )}
          </div>
          {qrOffen && qrDataUrl && (
            <div className="rounded-xl border border-zinc-700 bg-white p-4 text-center">
              {/* QR braucht hellen Grund — bewusst weiße Karte auf dunkler Seite */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Einlass-QR" className="mx-auto h-48 w-48" />
              <p className="mt-1 text-xs text-zinc-600">{t.qrHinweis}</p>
            </div>
          )}
        </>
      )}

      {!statusFinal && !vergangen && (zugesagt || abgesagt || wartend) && (
        <div className="flex gap-2">
          <input
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            placeholder={t.kommentar}
            maxLength={500}
            className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
          />
          {kommentar.trim() !== (comment ?? "") && (
            <button
              onClick={() =>
                senden(zugesagt ? "ja" : wartend ? "warteliste" : "nein", zugesagt ? { plus_ones: begleitung } : {})
              }
              disabled={laeuft}
              className="rounded-xl border border-zinc-600 px-3 py-2 text-sm text-zinc-200"
            >
              {t.speichern}
            </button>
          )}
        </div>
      )}

      {gespeichert && <p className="text-sm text-emerald-400">{t.gespeichert}</p>}
      {fehler && <p className="text-sm text-red-400">{fehler}</p>}
    </div>
  )
}
