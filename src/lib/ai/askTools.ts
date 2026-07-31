import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { daysUntilBirthday, connectionScore } from "@/lib/moments"
import { GIG_STATUS_LABELS, formatEuro } from "@/lib/artists"

/**
 * Werkzeugkasten für den Frage-Chat: feste, ausschließlich LESENDE Abfragen über
 * alle fünf Module. Das Modell schreibt hier kein SQL — es wählt nur eine
 * Funktion und füllt deren Parameter. Dadurch kann es weder Spalten erfinden
 * noch etwas verändern, und jede Abfrage ist ohne Modell testbar.
 *
 * Der Supabase-Client kommt aus der Nutzersitzung, RLS greift also zusätzlich.
 * Neue Tabelle heißt: hier ein Werkzeug ergänzen, sonst ändert sich nichts.
 */

type Db = SupabaseClient<Database>
type Args = Record<string, unknown>

export type AskTool = {
  name: string
  description: string
  parameters: {
    type: "object"
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required?: string[]
  }
  run: (db: Db, args: Args) => Promise<unknown>
}

// ---------------------------------------------------------------- Hilfsmittel

const str = (v: unknown): string => (typeof v === "string" ? v : "")
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback

/** Volle Tage zwischen Zeitpunkt und jetzt. Negativ = liegt in der Zukunft. */
export function tageSeit(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((now - t) / 86400_000)
}

/** Lange Freitexte kappen — das Modell braucht den Kern, nicht die Romanfassung. */
export function kuerze(text: string | null | undefined, max = 240): string | null {
  if (!text) return null
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length <= max ? clean : clean.slice(0, max - 1) + "…"
}

/** Umlaute und Groß-/Kleinschreibung raus, damit „Jörg“ auch auf „joerg“ passt. */
export function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

/**
 * Namenstreffer bewerten: exakt schlägt Wortanfang schlägt Teilstring.
 * 0 heißt kein Treffer. Bewusst simpel — bei einstelligen Kontaktzahlen reicht das.
 */
export function nameScore(query: string, name: string): number {
  const q = normName(query)
  const n = normName(name)
  if (!q || !n) return 0
  if (q === n) return 3
  if (n.startsWith(q)) return 2
  if (n.includes(q)) return 1
  return 0
}

export function rankKontakte<T extends { name: string }>(query: string, list: T[]): T[] {
  return list
    .map((c) => ({ c, s: nameScore(query, c.name) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name, "de"))
    .map((x) => x.c)
}

type Slot = { when: string; place: string }

/** Termin eines Meetups: der gewählte Slot, sonst nichts. */
export function slotDatum(
  slots: unknown,
  chosen: number | null | undefined
): { when: string; place: string } | null {
  if (chosen == null || !Array.isArray(slots)) return null
  const slot = slots[chosen] as Slot | undefined
  if (!slot || typeof slot.when !== "string") return null
  return { when: slot.when, place: typeof slot.place === "string" ? slot.place : "" }
}

/** Aus mehreren datierten Ereignissen das jüngste vergangene herausziehen. */
export function juengstes<T extends { when: string }>(items: T[], now = Date.now()): T | null {
  const past = items
    .filter((i) => {
      const t = new Date(i.when).getTime()
      return !Number.isNaN(t) && t <= now
    })
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
  return past[0] ?? null
}

const inTagen = (tage: number) => new Date(Date.now() + tage * 86400_000).toISOString()

// ------------------------------------------------------------------ Werkzeuge

export const ASK_TOOLS: AskTool[] = [
  {
    name: "finde_kontakt",
    description:
      "Sucht Personen nach Namen und liefert deren ID. IMMER zuerst aufrufen, bevor ein anderes Werkzeug eine kontakt_id braucht. Bei mehreren Treffern alle zurückgeben und nachfragen.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Gesuchter Name oder Namensteil" },
        realm: {
          type: "string",
          description: "Optional eingrenzen: moment = Freunde/Familie, match = Kennenlernen",
          enum: ["moment", "match"],
        },
      },
      required: ["name"],
    },
    async run(db, args) {
      const q = str(args.name)
      let query = db
        .from("contacts")
        .select("id, name, realm, platform, location, pipeline_stage, last_contact_at, birthday")
        .limit(200)
      const realm = str(args.realm)
      if (realm) query = query.eq("realm", realm)
      const { data, error } = await query
      if (error) return { fehler: error.message }
      const treffer = rankKontakte(q, data ?? [])
      if (!treffer.length) return { treffer: [], hinweis: `Keine Person namens „${q}“ gefunden.` }
      return {
        treffer: treffer.slice(0, 8).map((c) => ({
          kontakt_id: c.id,
          name: c.name,
          bereich: c.realm === "moment" ? "MomentOS" : "MatchOS",
          plattform: c.platform,
          ort: c.location,
          stufe: c.pipeline_stage,
          tage_seit_kontakt: tageSeit(c.last_contact_at),
          link: `/contacts/${c.id}`,
        })),
      }
    },
  },

  {
    name: "kontakt_profil",
    description:
      "Vollständiges Profil einer Person: Interessen, Ort, Geburtstag, Notizen, Beziehungs-Rhythmus, Verbindungs-Score.",
    parameters: {
      type: "object",
      properties: { kontakt_id: { type: "string", description: "ID aus finde_kontakt" } },
      required: ["kontakt_id"],
    },
    async run(db, args) {
      const { data, error } = await db
        .from("contacts")
        .select("*")
        .eq("id", str(args.kontakt_id))
        .maybeSingle()
      if (error) return { fehler: error.message }
      if (!data) return { fehler: "Kontakt nicht gefunden" }
      const { data: kanaele } = await db
        .from("contact_channels")
        .select("channel, handle, is_primary")
        .eq("contact_id", data.id)
      const score = connectionScore(data)
      return {
        name: data.name,
        bereich: data.realm === "moment" ? "MomentOS" : "MatchOS",
        alter: data.age,
        ort: data.location,
        sprache: data.language,
        plattform: data.platform,
        interessen: data.interests,
        beziehungs_tags: data.relationship_tags,
        absicht: data.intent,
        geburtstag: data.birthday,
        tage_bis_geburtstag: daysUntilBirthday(data.birthday),
        bio: kuerze(data.bio),
        notizen: kuerze(data.notes),
        naechster_schritt: data.next_step,
        stufe: data.pipeline_stage,
        prioritaet: data.priority,
        rhythmus_tage: data.contact_frequency_days,
        // Achtung: hoher Wert heißt ÜBERFÄLLIG, nicht „gute Verbindung".
        rhythmus_score_0_bis_100: score.score,
        ueberfaellig: score.overdue,
        tage_seit_kontakt: tageSeit(data.last_contact_at),
        wer_zuletzt: data.last_contact_initiator,
        kanaele: (kanaele ?? []).map((k) => ({ kanal: k.channel, handle: k.handle, primaer: k.is_primary })),
        link: `/contacts/${data.id}`,
      }
    },
  },

  {
    name: "kontakt_gedaechtnis",
    description:
      "Gemerkte Fakten zu einer Person: mag / mag nicht / Fakten / offene Fragen / Grenzen / Themen die ziehen.",
    parameters: {
      type: "object",
      properties: {
        kontakt_id: { type: "string", description: "ID aus finde_kontakt" },
        art: {
          type: "string",
          description: "Optional auf eine Art eingrenzen",
          enum: ["likes", "dislikes", "fact", "open_question", "boundary", "topic_works"],
        },
      },
      required: ["kontakt_id"],
    },
    async run(db, args) {
      let q = db
        .from("memories")
        .select("kind, content, created_at")
        .eq("contact_id", str(args.kontakt_id))
        .order("created_at", { ascending: false })
        .limit(60)
      const art = str(args.art)
      if (art) q = q.eq("kind", art as Database["public"]["Enums"]["memory_kind"])
      const { data, error } = await q
      if (error) return { fehler: error.message }
      return {
        eintraege: (data ?? []).map((m) => ({ art: m.kind, inhalt: m.content, notiert_am: m.created_at })),
      }
    },
  },

  {
    name: "letzter_kontakt",
    description:
      "Wann zuletzt geschrieben wurde, in welche Richtung, mit Auszug der letzten Nachrichten und der aktuellen Gesprächs-Zusammenfassung.",
    parameters: {
      type: "object",
      properties: {
        kontakt_id: { type: "string", description: "ID aus finde_kontakt" },
        anzahl: { type: "number", description: "Wie viele letzte Nachrichten, Standard 8" },
      },
      required: ["kontakt_id"],
    },
    async run(db, args) {
      const id = str(args.kontakt_id)
      const limit = Math.min(num(args.anzahl, 8), 25)
      const [msgs, summary] = await Promise.all([
        db
          .from("messages")
          .select("direction, content, sent_at, channel")
          .eq("contact_id", id)
          .order("sent_at", { ascending: false })
          .limit(limit),
        db
          .from("conversation_summaries")
          .select("summary, generated_at")
          .eq("contact_id", id)
          .order("generated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      const list = msgs.data ?? []
      const letzte = list[0]
      return {
        letzte_nachricht_am: letzte?.sent_at ?? null,
        tage_her: tageSeit(letzte?.sent_at),
        richtung: letzte ? (letzte.direction === "in" ? "von der Person" : "von dir") : null,
        anzahl_nachrichten_gesamt: list.length,
        zusammenfassung: kuerze(summary.data?.summary, 400),
        verlauf: list
          .slice()
          .reverse()
          .map((m) => ({
            wer: m.direction === "in" ? "sie/er" : "du",
            am: m.sent_at,
            kanal: m.channel,
            text: kuerze(m.content, 200),
          })),
      }
    },
  },

  {
    name: "letztes_treffen",
    description:
      "Wann man eine Person zuletzt PERSÖNLICH getroffen hat. Sucht in Meetups, Dates und besuchten Events. Für „wann habe ich X das letzte Mal gesehen“ genau dieses Werkzeug nehmen, nicht letzter_kontakt.",
    parameters: {
      type: "object",
      properties: { kontakt_id: { type: "string", description: "ID aus finde_kontakt" } },
      required: ["kontakt_id"],
    },
    async run(db, args) {
      const id = str(args.kontakt_id)
      const [parts, dates, invites] = await Promise.all([
        db
          .from("meetup_participants")
          .select("rsvp, meetups(id, title, status, slots, chosen_slot, recap)")
          .eq("contact_id", id),
        db.from("dates").select("id, starts_at, place, idea, status, notes").eq("contact_id", id),
        db
          .from("event_invites")
          .select("status, events(id, title, starts_at, location)")
          .eq("contact_id", id)
          .eq("status", "attended"),
      ])

      const treffen: { when: string; was: string; titel: string; ort: string; link: string; notiz: string | null }[] = []

      for (const p of parts.data ?? []) {
        const m = p.meetups
        if (!m || m.status === "cancelled") continue
        const slot = slotDatum(m.slots, m.chosen_slot)
        if (!slot) continue
        treffen.push({
          when: slot.when,
          was: "Meetup",
          titel: m.title,
          ort: slot.place,
          link: `/moments/meetups/${m.id}`,
          notiz: kuerze(m.recap, 160),
        })
      }
      for (const d of dates.data ?? []) {
        treffen.push({
          when: d.starts_at,
          was: "Date",
          titel: d.idea || "Date",
          ort: d.place ?? "",
          link: `/contacts/${id}`,
          notiz: kuerze(d.notes, 160),
        })
      }
      for (const i of invites.data ?? []) {
        const e = i.events
        if (!e?.starts_at) continue
        treffen.push({
          when: e.starts_at,
          was: "Event",
          titel: e.title,
          ort: e.location ?? "",
          link: `/moments/events/${e.id}`,
          notiz: null,
        })
      }

      const letzte = juengstes(treffen)
      if (!letzte) {
        return {
          letztes_treffen: null,
          hinweis:
            "Kein erfasstes Treffen. Das heißt nur, dass keines eingetragen ist — nicht, dass keines stattfand.",
          alle_treffen: [],
        }
      }
      return {
        letztes_treffen: {
          am: letzte.when,
          tage_her: tageSeit(letzte.when),
          art: letzte.was,
          titel: letzte.titel,
          ort: letzte.ort || null,
          notiz: letzte.notiz,
          link: letzte.link,
        },
        alle_treffen: treffen
          .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
          .slice(0, 10)
          .map((t) => ({ am: t.when, art: t.was, titel: t.titel, ort: t.ort || null })),
      }
    },
  },

  {
    name: "nachrichten_suchen",
    description:
      "Volltextsuche im Nachrichtenverlauf. Für Fragen wie „wer hat was über Berlin gesagt“ oder „wo ging es um Techno“.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Suchbegriff" },
        kontakt_id: { type: "string", description: "Optional auf eine Person eingrenzen" },
      },
      required: ["text"],
    },
    async run(db, args) {
      let q = db
        .from("messages")
        .select("contact_id, direction, content, sent_at, contacts(name)")
        .ilike("content", `%${str(args.text)}%`)
        .order("sent_at", { ascending: false })
        .limit(25)
      const id = str(args.kontakt_id)
      if (id) q = q.eq("contact_id", id)
      const { data, error } = await q
      if (error) return { fehler: error.message }
      return {
        treffer: (data ?? []).map((m) => ({
          person: m.contacts?.name ?? "?",
          kontakt_id: m.contact_id,
          wer: m.direction === "in" ? "sie/er" : "du",
          am: m.sent_at,
          text: kuerze(m.content, 220),
          link: `/contacts/${m.contact_id}`,
        })),
      }
    },
  },

  {
    name: "gedaechtnis_suchen",
    description:
      "Durchsucht die gemerkten Fakten aller Personen. Für „wer steht auf Techno“, „wer ist Vegetarier“, „wer wollte nach Wien“.",
    parameters: {
      type: "object",
      properties: { text: { type: "string", description: "Suchbegriff" } },
      required: ["text"],
    },
    async run(db, args) {
      const { data, error } = await db
        .from("memories")
        .select("kind, content, contact_id, contacts(name, realm)")
        .ilike("content", `%${str(args.text)}%`)
        .limit(40)
      if (error) return { fehler: error.message }
      return {
        treffer: (data ?? []).map((m) => ({
          person: m.contacts?.name ?? "?",
          bereich: m.contacts?.realm === "moment" ? "MomentOS" : "MatchOS",
          art: m.kind,
          inhalt: m.content,
          link: `/contacts/${m.contact_id}`,
        })),
      }
    },
  },

  {
    name: "kommende_termine",
    description:
      "Alles Datierte in den nächsten Tagen über alle Module: Dates, Meetups, Events, Gigs, fällige Follow-ups, Geburtstage.",
    parameters: {
      type: "object",
      properties: { tage: { type: "number", description: "Zeitfenster in Tagen, Standard 14" } },
      required: [],
    },
    async run(db, args) {
      const tage = Math.min(num(args.tage, 14), 120)
      const bis = inTagen(tage)
      const jetzt = new Date().toISOString()

      const [dates, events, gigs, followups, meetups, kontakte] = await Promise.all([
        db
          .from("dates")
          .select("starts_at, place, idea, status, contacts(name, id)")
          .gte("starts_at", jetzt)
          .lte("starts_at", bis),
        db.from("events").select("id, title, starts_at, location").gte("starts_at", jetzt).lte("starts_at", bis),
        db
          .from("gigs")
          .select("id, title, gig_date, venue, status, artists(name)")
          .gte("gig_date", jetzt.slice(0, 10))
          .lte("gig_date", bis.slice(0, 10)),
        db
          .from("followups")
          .select("due_at, reason, contact_id, contacts(name)")
          .eq("done", false)
          .lte("due_at", bis)
          .order("due_at"),
        db.from("meetups").select("id, title, status, slots, chosen_slot").neq("status", "cancelled"),
        db.from("contacts").select("id, name, birthday").not("birthday", "is", null),
      ])

      // Überfällige Follow-ups bleiben bewusst drin — sie sind das Dringlichste,
      // was es gibt. Sie werden aber markiert, damit sie nicht als „kommt noch"
      // durchgehen: ihr Fälligkeitsdatum liegt in der Vergangenheit.
      const termine: {
        am: string
        was: string
        titel: string
        detail: string | null
        link: string
        ueberfaellig?: boolean
      }[] = []
      for (const d of dates.data ?? []) {
        termine.push({
          am: d.starts_at,
          was: "Date",
          titel: `${d.contacts?.name ?? "?"} — ${d.idea || "Date"}`,
          detail: d.place,
          link: `/contacts/${d.contacts?.id ?? ""}`,
        })
      }
      for (const e of events.data ?? []) {
        if (!e.starts_at) continue
        termine.push({ am: e.starts_at, was: "Event", titel: e.title, detail: e.location, link: `/moments/events/${e.id}` })
      }
      for (const g of gigs.data ?? []) {
        if (!g.gig_date) continue
        termine.push({
          am: g.gig_date,
          was: "Gig",
          titel: `${g.artists?.name ?? "?"} — ${g.title || "Gig"}`,
          detail: g.venue,
          link: `/book/artists`,
        })
      }
      for (const f of followups.data ?? []) {
        termine.push({
          am: f.due_at,
          was: "Follow-up",
          titel: f.contacts?.name ?? "?",
          detail: f.reason,
          link: `/contacts/${f.contact_id}`,
          ueberfaellig: f.due_at < jetzt,
        })
      }
      for (const m of meetups.data ?? []) {
        const slot = slotDatum(m.slots, m.chosen_slot)
        if (!slot || slot.when < jetzt || slot.when > bis) continue
        termine.push({ am: slot.when, was: "Meetup", titel: m.title, detail: slot.place, link: `/moments/meetups/${m.id}` })
      }
      const geburtstage = (kontakte.data ?? [])
        .map((c) => ({ c, d: daysUntilBirthday(c.birthday) }))
        .filter((x) => x.d != null && x.d <= tage)
        .map((x) => ({
          am: inTagen(x.d as number).slice(0, 10),
          was: "Geburtstag",
          titel: x.c.name,
          detail: `in ${x.d} Tagen`,
          link: `/contacts/${x.c.id}`,
        }))

      // Die Fälligkeit als fertigen Satzbaustein mitgeben statt als Flag: ein
      // Feld „überfällig seit 21 Tagen" übersieht das Modell nicht, ein
      // boolesches ueberfaellig schon.
      const alle = [...termine, ...geburtstage]
        .sort((a, b) => a.am.localeCompare(b.am))
        .slice(0, 40)
        .map((t) => {
          const d = tageSeit(t.am)
          return {
            ...t,
            ueberfaellig: undefined,
            faelligkeit:
              d == null ? null : d > 0 ? `überfällig seit ${d} Tagen` : d === 0 ? "heute fällig" : `in ${-d} Tagen`,
          }
        })
      const offen = alle.filter((t) => t.faelligkeit?.startsWith("überfällig")).length
      return {
        zeitfenster_tage: tage,
        anzahl_ueberfaellig: offen,
        hinweis:
          offen > 0
            ? `${offen} Einträge sind ÜBERFÄLLIG — ihr Datum liegt in der Vergangenheit. Diese niemals als kommende Termine darstellen. Das Feld faelligkeit enthält die richtige Formulierung, benutze sie.`
            : undefined,
        termine: alle,
      }
    },
  },

  {
    name: "vernachlaessigte_kontakte",
    description:
      "Wer aus dem Rhythmus gefallen ist — Personen mit gesetztem Kontakt-Rhythmus, bei denen zu lange nichts passiert ist.",
    parameters: {
      type: "object",
      properties: { anzahl: { type: "number", description: "Wie viele, Standard 10" } },
      required: [],
    },
    async run(db, args) {
      const { data, error } = await db
        .from("contacts")
        .select("id, name, realm, last_contact_at, contact_frequency_days, relationship_tags")
        .not("contact_frequency_days", "is", null)
      if (error) return { fehler: error.message }
      // Der Score wächst mit der Überfälligkeit — die schlimmsten Fälle stehen oben.
      const bewertet = (data ?? [])
        .map((c) => ({ c, s: connectionScore(c) }))
        .filter((x) => x.s.overdue)
        .sort((a, b) => b.s.score - a.s.score)
        .slice(0, Math.min(num(args.anzahl, 10), 30))
      return {
        hinweis: "Sortiert nach Dringlichkeit, oben die am längsten überfälligen.",
        kontakte: bewertet.map((x) => ({
          name: x.c.name,
          bereich: x.c.realm === "moment" ? "MomentOS" : "MatchOS",
          rhythmus_score_0_bis_100: x.s.score,
          rhythmus_tage: x.c.contact_frequency_days,
          tage_seit_kontakt: tageSeit(x.c.last_contact_at),
          tags: x.c.relationship_tags,
          link: `/contacts/${x.c.id}`,
        })),
      }
    },
  },

  {
    name: "geburtstage",
    description: "Anstehende Geburtstage im gewählten Zeitfenster.",
    parameters: {
      type: "object",
      properties: { tage: { type: "number", description: "Vorlauf in Tagen, Standard 30" } },
      required: [],
    },
    async run(db, args) {
      const tage = Math.min(num(args.tage, 30), 365)
      const { data, error } = await db
        .from("contacts")
        .select("id, name, birthday, realm")
        .not("birthday", "is", null)
      if (error) return { fehler: error.message }
      return {
        geburtstage: (data ?? [])
          .map((c) => ({ c, d: daysUntilBirthday(c.birthday) }))
          .filter((x) => x.d != null && (x.d as number) <= tage)
          .sort((a, b) => (a.d as number) - (b.d as number))
          .map((x) => ({
            name: x.c.name,
            datum: x.c.birthday,
            in_tagen: x.d,
            bereich: x.c.realm === "moment" ? "MomentOS" : "MatchOS",
            link: `/contacts/${x.c.id}`,
          })),
      }
    },
  },

  {
    name: "events_uebersicht",
    description:
      "Events mit Zusagen, Absagen, Tickets und tatsächlich Erschienenen. Ohne event_id: alle Events. Für Fragen zu Gästezahlen und Ticket-Erlös.",
    parameters: {
      type: "object",
      properties: { event_id: { type: "string", description: "Optional ein bestimmtes Event" } },
      required: [],
    },
    async run(db, args) {
      let q = db.from("events").select("*").order("starts_at", { ascending: false }).limit(20)
      const id = str(args.event_id)
      if (id) q = q.eq("id", id)
      const { data, error } = await q
      if (error) return { fehler: error.message }
      const events = data ?? []
      const ids = events.map((e) => e.id)
      const { data: invites } = await db
        .from("event_invites")
        .select("event_id, status, promo_code, contacts(name)")
        .in("event_id", ids.length ? ids : ["-"])

      return {
        events: events.map((e) => {
          const meine = (invites ?? []).filter((i) => i.event_id === e.id)
          const zaehle = (s: string) => meine.filter((i) => i.status === s).length
          const tickets = zaehle("ticket")
          return {
            event_id: e.id,
            titel: e.title,
            beginnt: e.starts_at,
            ort: e.location,
            kapazitaet: e.capacity,
            eingeladen: meine.length,
            zugesagt: zaehle("yes"),
            abgesagt: zaehle("no"),
            keine_antwort: zaehle("no_reply") + zaehle("invited"),
            tickets,
            erschienen: zaehle("attended"),
            ticket_preis: e.ticket_price_cents != null ? formatEuro(e.ticket_price_cents) : null,
            erloes_geschaetzt:
              e.ticket_price_cents != null ? formatEuro(tickets * e.ticket_price_cents) : null,
            kosten: e.other_costs_cents != null ? formatEuro(e.other_costs_cents) : null,
            link: `/moments/events/${e.id}`,
          }
        }),
      }
    },
  },

  {
    name: "pipeline_uebersicht",
    description:
      "MatchOS-Stand: wie viele Kontakte in welcher Pipeline-Stufe, aufgeschlüsselt nach Plattform, plus eingeschlafene Gespräche.",
    parameters: { type: "object", properties: {}, required: [] },
    async run(db) {
      const { data, error } = await db
        .from("contacts")
        .select("pipeline_stage, platform, last_contact_at, name, id")
        .eq("realm", "match")
      if (error) return { fehler: error.message }
      const list = data ?? []
      const proStufe: Record<string, number> = {}
      const proPlattform: Record<string, number> = {}
      for (const c of list) {
        proStufe[c.pipeline_stage] = (proStufe[c.pipeline_stage] ?? 0) + 1
        proPlattform[c.platform] = (proPlattform[c.platform] ?? 0) + 1
      }
      const eingeschlafen = list
        .filter((c) => c.pipeline_stage !== "archived" && (tageSeit(c.last_contact_at) ?? 0) > 7)
        .sort((a, b) => (tageSeit(b.last_contact_at) ?? 0) - (tageSeit(a.last_contact_at) ?? 0))
        .slice(0, 10)
      return {
        gesamt: list.length,
        pro_stufe: proStufe,
        pro_plattform: proPlattform,
        eingeschlafen: eingeschlafen.map((c) => ({
          name: c.name,
          stufe: c.pipeline_stage,
          tage_still: tageSeit(c.last_contact_at),
          link: `/contacts/${c.id}`,
        })),
      }
    },
  },

  {
    name: "offene_entwuerfe",
    description:
      "Was in der Freigabe-Queue liegt: erzeugte Nachrichten, die noch auf deine Freigabe warten oder freigegeben aber unversendet sind.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Standard: draft",
          enum: ["draft", "approved", "sent", "discarded"],
        },
      },
      required: [],
    },
    async run(db, args) {
      const status = (str(args.status) || "draft") as Database["public"]["Enums"]["suggestion_status"]
      const { data, error } = await db
        .from("suggestions")
        .select("id, situation, channel, status, created_at, contact_id, contacts(name)")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(30)
      if (error) return { fehler: error.message }
      return {
        status,
        anzahl: (data ?? []).length,
        entwuerfe: (data ?? []).map((s) => ({
          person: s.contacts?.name ?? "?",
          anlass: kuerze(s.situation, 120),
          kanal: s.channel,
          erstellt: s.created_at,
          link: `/queue`,
        })),
      }
    },
  },

  {
    name: "bewerbungen",
    description: "JobOS: Bewerbungen mit Stufe, Match-Score, Firma, Stadt und nächster Aktion.",
    parameters: {
      type: "object",
      properties: {
        stufe: { type: "string", description: "Optional nach Stufe filtern, z. B. gefunden, beworben, interview" },
        anzahl: { type: "number", description: "Standard 15" },
      },
      required: [],
    },
    async run(db, args) {
      let q = db
        .from("job_applications")
        .select("id, title, company, city, stage, match_score, applied_at, next_action, salary, portal, url")
        .order("match_score", { ascending: false, nullsFirst: false })
        .limit(Math.min(num(args.anzahl, 15), 50))
      const stufe = str(args.stufe)
      if (stufe) q = q.eq("stage", stufe)
      const { data, error } = await q
      if (error) return { fehler: error.message }
      return {
        bewerbungen: (data ?? []).map((j) => ({
          titel: j.title,
          firma: j.company,
          stadt: j.city,
          stufe: j.stage,
          match_score: j.match_score,
          beworben_am: j.applied_at,
          tage_seit_bewerbung: tageSeit(j.applied_at),
          gehalt: j.salary,
          portal: j.portal,
          naechste_aktion: j.next_action,
          link: `/jobs/${j.id}`,
        })),
      }
    },
  },

  {
    name: "job_funnel",
    description: "JobOS in Zahlen: Bewerbungen pro Stufe, pro Portal, Durchschnitts-Match, Interview-Quote.",
    parameters: { type: "object", properties: {}, required: [] },
    async run(db) {
      const { data, error } = await db.from("job_applications").select("stage, portal, match_score, applied_at")
      if (error) return { fehler: error.message }
      const list = data ?? []
      const proStufe: Record<string, number> = {}
      const proPortal: Record<string, number> = {}
      for (const j of list) {
        proStufe[j.stage] = (proStufe[j.stage] ?? 0) + 1
        if (j.portal) proPortal[j.portal] = (proPortal[j.portal] ?? 0) + 1
      }
      const scores = list.map((j) => j.match_score).filter((s): s is number => s != null)
      const beworben = list.filter((j) => j.applied_at).length
      return {
        gesamt: list.length,
        pro_stufe: proStufe,
        pro_portal: proPortal,
        durchschnitt_match: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        tatsaechlich_beworben: beworben,
      }
    },
  },

  {
    name: "artists_und_gigs",
    description:
      "BookOS: Artist-Kartei und Gig-Pipeline mit Gagen. Für „welche DJs kenne ich“, „was ist noch offen“, „was habe ich für Gagen gezahlt“.",
    parameters: {
      type: "object",
      properties: {
        genre: { type: "string", description: "Optional nach Genre filtern" },
        gig_status: {
          type: "string",
          description: "Optional Gigs nach Status filtern",
          enum: ["idea", "inquired", "negotiating", "confirmed", "contracted", "played", "cancelled"],
        },
      },
      required: [],
    },
    async run(db, args) {
      const genre = str(args.genre)
      const [artistRes, gigRes] = await Promise.all([
        db.from("artists").select("id, name, artist_type, genres, city, fee_min_cents, fee_max_cents, rating, active"),
        (() => {
          let q = db
            .from("gigs")
            .select("id, title, gig_date, venue, status, fee_cents, artists(name)")
            .order("gig_date", { ascending: false, nullsFirst: false })
            .limit(40)
          const s = str(args.gig_status)
          if (s) q = q.eq("status", s as Database["public"]["Enums"]["gig_status"])
          return q
        })(),
      ])
      if (artistRes.error) return { fehler: artistRes.error.message }
      const artists = (artistRes.data ?? []).filter(
        (a) => !genre || (a.genres ?? []).some((g) => g.toLowerCase().includes(genre.toLowerCase()))
      )
      const gigs = gigRes.data ?? []
      const summeGezahlt = gigs
        .filter((g) => g.status === "played")
        .reduce((sum, g) => sum + (g.fee_cents ?? 0), 0)
      return {
        artists: artists.map((a) => ({
          name: a.name,
          typ: a.artist_type,
          genres: a.genres,
          stadt: a.city,
          gagen_rahmen:
            a.fee_min_cents != null || a.fee_max_cents != null
              ? `${a.fee_min_cents != null ? formatEuro(a.fee_min_cents) : "?"} – ${a.fee_max_cents != null ? formatEuro(a.fee_max_cents) : "?"}`
              : null,
          bewertung: a.rating,
          aktiv: a.active,
          link: `/book/artists/${a.id}`,
        })),
        gigs: gigs.map((g) => ({
          artist: g.artists?.name ?? "?",
          titel: g.title,
          datum: g.gig_date,
          ort: g.venue,
          status: GIG_STATUS_LABELS[g.status] ?? g.status,
          gage: g.fee_cents != null ? formatEuro(g.fee_cents) : null,
        })),
        summe_gagen_gespielt: formatEuro(summeGezahlt),
      }
    },
  },

  {
    name: "buchungen",
    description: "BookOS: Treatment-Buchungen mit Status, Preis und Zeitpunkt.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Optional filtern",
          enum: ["requested", "accepted", "en_route", "arrived", "in_progress", "completed", "cancelled"],
        },
      },
      required: [],
    },
    async run(db, args) {
      let q = db
        .from("bookings")
        .select("id, address, status, price_cents, travel_fee_cents, scheduled_at, created_at, completed_at, payment_status, treatments(name)")
        .order("created_at", { ascending: false })
        .limit(25)
      const s = str(args.status)
      if (s) q = q.eq("status", s as Database["public"]["Enums"]["booking_status"])
      const { data, error } = await q
      if (error) return { fehler: error.message }
      return {
        buchungen: (data ?? []).map((b) => ({
          treatment: b.treatments?.name ?? "?",
          status: b.status,
          termin: b.scheduled_at,
          erstellt: b.created_at,
          abgeschlossen: b.completed_at,
          preis: formatEuro(b.price_cents + (b.travel_fee_cents ?? 0)),
          zahlung: b.payment_status,
          link: `/book/bookings`,
        })),
      }
    },
  },

  {
    name: "trading_stand",
    description:
      "TradingOS: Stand des Papier-Depots gegen die Vergleichsanlage, offene Thesen und letzte Bewertungen. AUSSCHLIESSLICH Spielgeld, keine echten Trades.",
    parameters: { type: "object", properties: {}, required: [] },
    async run(db) {
      const { data, error } = await db
        .from("paper_trades")
        .select("symbol, label, amount_eur, price_usd, units, thesis, verdict, traded_at, is_benchmark")
        .order("traded_at", { ascending: false })
        .limit(60)
      if (error) return { fehler: error.message }
      const list = data ?? []
      const depot = list.filter((t) => !t.is_benchmark)
      const bench = list.filter((t) => t.is_benchmark)
      const summe = (rows: typeof list) => rows.reduce((s, t) => s + t.amount_eur, 0)
      return {
        hinweis: "Papierdepot mit Spielgeld — keine Bank, keine echten Orders.",
        positionen_gesamt: depot.length,
        eingesetzt_depot_eur: Math.round(summe(depot)),
        eingesetzt_vergleich_eur: Math.round(summe(bench)),
        offene_thesen: depot
          .filter((t) => t.verdict === "offen" || !t.verdict)
          .slice(0, 10)
          .map((t) => ({ symbol: t.symbol, name: t.label, am: t.traded_at, these: kuerze(t.thesis, 200) })),
        letzte_bewertungen: depot
          .filter((t) => t.verdict && t.verdict !== "offen")
          .slice(0, 10)
          .map((t) => ({ symbol: t.symbol, urteil: t.verdict, am: t.traded_at })),
        link: "/trading",
      }
    },
  },

  {
    name: "antwortquoten",
    description:
      "Was tatsächlich funktioniert: Bewertungen und Antwortquoten der erzeugten Nachrichten, nach Stil aufgeschlüsselt.",
    parameters: { type: "object", properties: {}, required: [] },
    async run(db) {
      const [fb, sug] = await Promise.all([
        db.from("reply_feedback").select("style, rating, source, created_at").limit(300),
        db.from("suggestions").select("status, sent_at, replied_at, channel").not("sent_at", "is", null).limit(300),
      ])
      const proStil: Record<string, { anzahl: number; schnitt: number }> = {}
      for (const f of fb.data ?? []) {
        const k = f.style ?? "ohne Stil"
        const cur = proStil[k] ?? { anzahl: 0, schnitt: 0 }
        cur.schnitt = (cur.schnitt * cur.anzahl + f.rating) / (cur.anzahl + 1)
        cur.anzahl += 1
        proStil[k] = cur
      }
      const gesendet = sug.data ?? []
      const beantwortet = gesendet.filter((s) => s.replied_at).length
      return {
        pro_stil: Object.fromEntries(
          Object.entries(proStil).map(([k, v]) => [k, { anzahl: v.anzahl, durchschnitt: Math.round(v.schnitt * 10) / 10 }])
        ),
        gesendet: gesendet.length,
        beantwortet,
        antwortquote_prozent: gesendet.length ? Math.round((beantwortet / gesendet.length) * 100) : null,
      }
    },
  },

  {
    name: "ki_kosten",
    description: "Was die KI-Nutzung diesen Monat gekostet hat, aufgeschlüsselt nach Funktion.",
    parameters: { type: "object", properties: {}, required: [] },
    async run(db) {
      const seitMonatsbeginn = new Date()
      seitMonatsbeginn.setDate(1)
      seitMonatsbeginn.setHours(0, 0, 0, 0)
      const { data, error } = await db
        .from("ai_usage")
        .select("feature, provider, model, cost_usd, created_at")
        .gte("created_at", seitMonatsbeginn.toISOString())
        .limit(2000)
      if (error) return { fehler: error.message }
      const list = data ?? []
      const proFeature: Record<string, number> = {}
      let summe = 0
      for (const u of list) {
        const c = typeof u.cost_usd === "number" ? u.cost_usd : 0
        proFeature[u.feature] = (proFeature[u.feature] ?? 0) + c
        summe += c
      }
      return {
        monat_bisher_usd: Math.round(summe * 10000) / 10000,
        aufrufe: list.length,
        pro_funktion: Object.fromEntries(
          Object.entries(proFeature)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => [k, Math.round(v * 10000) / 10000])
        ),
        link: "/settings",
      }
    },
  },

  {
    name: "plattform_statistik",
    description:
      "Überblick in Zahlen über alle Module: Kontakte, Nachrichten, Events, Bewerbungen, Artists, Gigs, Buchungen.",
    parameters: { type: "object", properties: {}, required: [] },
    async run(db) {
      const zaehle = async (t: "contacts" | "messages" | "events" | "job_applications" | "artists" | "gigs" | "bookings" | "meetups" | "memories") => {
        const { count } = await db.from(t).select("*", { count: "exact", head: true })
        return count ?? 0
      }
      const [contacts, messages, events, jobs, artists, gigs, bookings, meetups, memories] = await Promise.all([
        zaehle("contacts"),
        zaehle("messages"),
        zaehle("events"),
        zaehle("job_applications"),
        zaehle("artists"),
        zaehle("gigs"),
        zaehle("bookings"),
        zaehle("meetups"),
        zaehle("memories"),
      ])
      const { data: realms } = await db.from("contacts").select("realm")
      const moments = (realms ?? []).filter((r) => r.realm === "moment").length
      return {
        kontakte_gesamt: contacts,
        davon_momentos: moments,
        davon_matchos: contacts - moments,
        nachrichten: messages,
        gemerkte_fakten: memories,
        events,
        meetups,
        bewerbungen: jobs,
        artists,
        gigs,
        buchungen: bookings,
      }
    },
  },
]

export const ASK_TOOL_BY_NAME = new Map(ASK_TOOLS.map((t) => [t.name, t]))

/** Schema-Teil für die API — ohne `run`, das bleibt serverseitig. */
export function toolSchemas() {
  return ASK_TOOLS.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))
}
