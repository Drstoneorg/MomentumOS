import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { AskTool } from "@/lib/ai/askTools"

/**
 * Werkzeuge für das zweite Supabase-Projekt (Shrine): die AirbnbWorker-App
 * (Reservierungen, Putzplan, Gäste-Nachrichten) und die Shrine-Community.
 * MusicDash hat dort keine Tabellen — dafür gibt es nichts abzufragen.
 *
 * Zugriff läuft über den Service-Key des Shrine-Projekts, NICHT über die
 * Nutzersitzung — deshalb gilt hier dieselbe eiserne Regel wie in askTools:
 * ausschließlich LESEN. Ein Guard-Test scannt die Datei auf Schreibzugriffe.
 * Ohne SHRINE_SERVICE_ROLE_KEY erscheint nur ein Status-Werkzeug, das sagt,
 * was fehlt — statt Fragen still ins Leere laufen zu lassen.
 */

const SHRINE_URL = process.env.SHRINE_SUPABASE_URL ?? "https://pfzjnwboudgwqzyfrqmi.supabase.co"

let cached: SupabaseClient | null = null
function shrine(): SupabaseClient {
  if (!cached) {
    const key = process.env.SHRINE_SERVICE_ROLE_KEY
    if (!key) throw new Error("SHRINE_SERVICE_ROLE_KEY fehlt")
    cached = createClient(SHRINE_URL, key, { auth: { persistSession: false } })
  }
  return cached
}

const heute = () => new Date().toISOString().slice(0, 10)

/** Ohne generierte Typen kommt ein Join mal als Objekt, mal als Array an. */
function joinName(v: unknown): string | null {
  const kandidat = Array.isArray(v) ? v[0] : v
  if (kandidat && typeof kandidat === "object" && "name" in kandidat) {
    const name = (kandidat as { name: unknown }).name
    return typeof name === "string" ? name : null
  }
  return null
}

const konfiguriert = !!process.env.SHRINE_SERVICE_ROLE_KEY

const werkzeuge: AskTool[] = [
  {
    name: "airbnb_reservierungen",
    description:
      "AirbnbWorker: Reservierungen der Ferienwohnungen mit Check-in/Check-out, Gastname und Status. Standard: heutige und kommende.",
    parameters: {
      type: "object",
      properties: {
        auch_vergangene: { type: "string", description: "„ja“ = auch abgereiste Gäste zeigen", enum: ["ja", "nein"] },
      },
      required: [],
    },
    async run(_db, args) {
      let q = shrine()
        .from("airbnbworker_reservations")
        .select("guest_name, check_in, check_out, arrival_time, status, reservation_code, airbnbworker_listings(name)")
        .order("check_in", { ascending: true })
        .limit(40)
      if (args.auch_vergangene !== "ja") q = q.gte("check_out", heute())
      const { data, error } = await q
      if (error) return { fehler: error.message }
      return {
        reservierungen: (data ?? []).map((r) => ({
          gast: r.guest_name,
          wohnung: joinName(r.airbnbworker_listings),
          check_in: r.check_in,
          check_out: r.check_out,
          ankunftszeit: r.arrival_time,
          status: r.status,
          code: r.reservation_code,
        })),
      }
    },
  },

  {
    name: "airbnb_putzplan",
    description:
      "AirbnbWorker: offene und erledigte Reinigungen (nach Checkout) plus Giorgias Arbeitsschichten. Für „wann ist die nächste Reinigung“, „wann arbeitet Giorgia“.",
    parameters: { type: "object", properties: {}, required: [] },
    async run() {
      const [tasks, shifts] = await Promise.all([
        shrine()
          .from("airbnbworker_cleaning_tasks")
          .select("listing_name, guest_name, checkout_date, next_checkin, status, done_at")
          .order("checkout_date", { ascending: false })
          .limit(25),
        shrine()
          .from("airbnbworker_giorgia_work_shifts")
          .select("shift_date, start_time, end_time, workplace")
          .gte("shift_date", heute())
          .order("shift_date", { ascending: true })
          .limit(20),
      ])
      if (tasks.error) return { fehler: tasks.error.message }
      return {
        reinigungen: (tasks.data ?? []).map((t) => ({
          wohnung: t.listing_name,
          nach_gast: t.guest_name,
          checkout: t.checkout_date,
          naechster_checkin: t.next_checkin,
          status: t.status,
          erledigt_am: t.done_at,
        })),
        giorgia_schichten: (shifts.data ?? []).map((s) => ({
          am: s.shift_date,
          von: s.start_time,
          bis: s.end_time,
          wo: s.workplace,
        })),
      }
    },
  },

  {
    name: "airbnb_gaeste_nachrichten",
    description:
      "AirbnbWorker: Gäste-Konversationen mit letzter Nachricht, ungelesen-Status und Buchungsstatus. Für „hat ein Gast geschrieben“, „was ist ungelesen“.",
    parameters: { type: "object", properties: {}, required: [] },
    async run() {
      const { data, error } = await shrine()
        .from("airbnbworker_guest_threads")
        .select("guest_name, listing_name, last_message_preview, last_message_at, unread, booking_status")
        .order("last_message_at", { ascending: false })
        .limit(20)
      if (error) return { fehler: error.message }
      return {
        ungelesen: (data ?? []).filter((t) => t.unread).length,
        threads: (data ?? []).map((t) => ({
          gast: t.guest_name,
          wohnung: t.listing_name,
          letzte_nachricht: t.last_message_preview,
          am: t.last_message_at,
          ungelesen: t.unread,
          buchungsstatus: t.booking_status,
        })),
      }
    },
  },

  {
    name: "airbnb_worker_status",
    description:
      "AirbnbWorker: Zustand des Scraper-Workers — letzter Heartbeat, Login-Status. Für „läuft der Airbnb-Worker noch“.",
    parameters: { type: "object", properties: {}, required: [] },
    async run() {
      const { data, error } = await shrine()
        .from("airbnbworker_worker_heartbeats")
        .select("worker_id, status, login_ok, created_at")
        .order("created_at", { ascending: false })
        .limit(5)
      if (error) return { fehler: error.message }
      const letzter = (data ?? [])[0]
      return {
        letzter_heartbeat: letzter?.created_at ?? null,
        status: letzter?.status ?? null,
        login_ok: letzter?.login_ok ?? null,
        letzte_5: data ?? [],
      }
    },
  },
]

const statusStub: AskTool = {
  name: "airbnb_status",
  description:
    "AirbnbWorker-Anbindung (Reservierungen, Putzplan, Gäste) — meldet, ob die Verbindung zum zweiten Supabase-Projekt eingerichtet ist.",
  parameters: { type: "object", properties: {}, required: [] },
  async run() {
    return {
      hinweis:
        "Die AirbnbWorker-Anbindung ist noch nicht eingerichtet: In Vercel fehlt die Umgebungsvariable SHRINE_SERVICE_ROLE_KEY (Service-Key des Shrine-Projekts). Sobald sie gesetzt ist, beantworte ich Fragen zu Reservierungen, Putzplan und Gäste-Nachrichten.",
    }
  },
}

export const SHRINE_TOOLS: AskTool[] = konfiguriert ? werkzeuge : [statusStub]
