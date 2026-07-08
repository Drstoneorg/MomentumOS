# MatchOS

Persönlicher Dating-Agent: zentrale Matchbox, Gespräche mit Personengedächtnis, DeepSeek-Antwortgenerator, Dating-Pipeline, Follow-ups, Date-Planung mit Kalender-Export und Telegram-Integration mit Freigabe-Queue.

## Stack

- Next.js 15 (App Router, TypeScript, Tailwind), Vercel-ready
- Supabase (Postgres + Auth), Projekt `matchos` (eu-central-1)
- DeepSeek API (`deepseek-chat`) für Antwortvarianten, Zusammenfassungen, Pipeline-Analyse
- gramjs für Telegram (lokaler Worker)
- ICS-Export für Apple/Google/Outlook-Kalender

## Setup

```bash
npm install
npm run dev        # http://localhost:3000
```

`.env.local` (bereits angelegt, Keys ergänzen):

| Variable | Zweck |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | gesetzt |
| `DEEPSEEK_API_KEY` | von https://platform.deepseek.com — ohne Key funktioniert alles außer den KI-Funktionen |
| `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` | von https://my.telegram.org/apps (nur für Worker) |
| `TELEGRAM_SESSION` | erzeugt `npm run telegram:login` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API (nur für lokalen Worker, nie deployen) |

## Workflow

1. **Match anlegen** (Matchbox → Neues Match) — Plattform, Bio, Interessen.
2. **Chat importieren**: Verlauf einfügen, eigene Zeilen mit `ich:` markieren. Oder Nachrichten einzeln eintragen.
3. **Zusammenfassen**: KI erzeugt Gesprächszusammenfassung + Gedächtnis-Einträge (mag / mag nicht / offene Fragen / Grenzen).
4. **Antwortgenerator**: Situation beschreiben → 6 Stilvarianten (locker/charmant/direkt/witzig/flirty/höflich) + Empfehlung für den nächsten Schritt. Bei Sprache ja/zh: Original + Übersetzung + Umschrift + Kultur-Hinweis.
5. **KI-Analyse** (Kopfzeile der Personenseite): setzt Pipeline-Stage, nächsten Schritt, Date-Idee, legt Follow-up an.
6. **Plattformwechsel**: Handle unter „Kontaktwege" eintragen (Telegram, WhatsApp, Instagram, …).
7. **Date eintragen** → `.ics` herunterladen → Kalender-App öffnet Eintrag mit Zusammenfassung, Notizen und Erinnerung (2h vorher).

## Telegram-Worker (optional)

```bash
npm run telegram:login   # einmalig, schreibt TELEGRAM_SESSION
npm run worker           # läuft lokal
```

- Eingehende Telegram-Nachrichten von Kontakten mit hinterlegtem Handle landen automatisch im Chatverlauf.
- Im Antwortgenerator Kanal „Telegram (Queue)" wählen → Entwurf erscheint unter **/queue** → Variante wählen, freigeben → Worker sendet. **Ohne Freigabe wird nie gesendet.**

⚠ Automatisierung des eigenen Telegram-Accounts ist ToS-Grauzone. Eigenverantwortlich und mit moderater Frequenz nutzen. Die App umgeht keine Sicherheitsmechanismen; Dating-Apps werden bewusst per Copy-Paste angebunden.

## Browser-Extension (MatchOS Companion)

Läuft auf tinder.com, bumble.com, boo.world, badoo.com, web.whatsapp.com, instagram.com, web.telegram.org. Liest sichtbaren Profil-/Chattext, legt Kontakte an, liefert Antwortvarianten ins Overlay. **Sendet nie selbst.** (Hinge hat kein Web-Interface — dort Screenshot/Copy-Paste in den Smart-Import.)

Installation:
1. Chrome → `chrome://extensions` → Entwicklermodus an → „Entpackte Erweiterung laden" → Ordner `extension/` wählen.
2. In MatchOS → Einstellungen → „Token generieren", kopieren.
3. Extension-Icon klicken → MatchOS-URL (`https://matchos-ten.vercel.app`) + Token speichern.
4. Auf einer unterstützten Seite: roter M-Button unten rechts → „Scannen & Syncen".

Weitere Extension-Funktionen (v0.3):
- **↳ Einfügen** (WhatsApp-Web/Instagram/Telegram-Web): setzt den gewählten Antwortentwurf direkt ins Chat-Eingabefeld — Enter drückst du selbst, es wird nie automatisch gesendet.
- **Rechtsklick → „An MatchOS senden"**: markierten Text (Profil oder Chat) per Kontextmenü syncen. Ergebnis erscheint im Overlay; auf Seiten ohne Overlay als ✓/✗-Badge am Extension-Icon.
- **Session-Roundup**: das Overlay zählt pro Tab-Session geprüfte Profile, Typ-Treffer, Ausschlüsse, Syncs und Likes ("Session: 12 geprüft · 4 Typ-Treffer …"), Reset-Knopf inklusive.

Voraussetzung: `SUPABASE_SERVICE_ROLE_KEY` als Env-Variable in Vercel (Extension-API und Follow-up-Cron laufen ohne Browser-Login). Supabase Dashboard → Settings → API → `service_role` kopieren.

## Kommunikationskanäle

| Kanal | Automatik | Was geht |
|---|---|---|
| Telegram | ✓ Worker sendet nach Queue-Freigabe | voll |
| WhatsApp | Deep-Link mit vorbefüllter Nachricht (`wa.me`) | ein Klick zum Senden |
| Instagram | Deep-Link zum DM-Chat, Text in Zwischenablage | zwei Klicks |
| TikTok / Snapchat / LINE | Profil-Link + Zwischenablage | manuell |
| WeChat | kein Web-Link — Zwischenablage | manuell |

Im Antwortgenerator Kanal wählen → Entwurf landet in der Queue → freigeben → Deep-Link-Buttons erscheinen (Text wird beim Klick kopiert) → „Habe gesendet" schreibt die Nachricht in den Verlauf.

## MatchOS Moments

Erweiterungsmodul für persönliche Momente & Freundschaftspflege (`/moments`).

- **Friends Management** (Kontaktseite, Karte „Freundschaft"): Geburtstag, Beziehungsgruppen-Tags, Melde-Rhythmus, Verbindungs-Score (Balken + Tage seit letztem Kontakt), „Habe mich gemeldet". Jede Nachricht aktualisiert den letzten Kontakt automatisch.
- **Moments-Generator** (Kontaktseite): Anlass-Nachrichten (Geburtstag/Check-in/Rückblick) in 5 Stilen; Bild-Prompt-Generator (Anlass + Stil + Format → fertiger Midjourney/DALL-E-Prompt + Caption). Ergebnisse landen in der Asset Library.
- **Events** (`/moments/events`): anlegen, Personen/Gruppen einladen (Tag-Filter), KI-Einladungstexte pro Person, RSVP-Tracking, Deep-Link-Versand.
- **Meetups** (`/moments/meetups`): Slot A/B/C-Terminvorschläge, Status idea→confirmed→happened, ICS mit Reminder 1 Tag + 2 h vorher, Nachbereitung („wie war's") fließt als Gedächtnis-Eintrag zu allen Teilnehmern.
- **Einladen & Benachrichtigen** (Meetup-Detailseite): erzeugt einen Einladungstext mit Ort+Zeit und verschickt ihn pro Teilnehmer über dessen Kanäle — WhatsApp/SMS/E-Mail vorbefüllt per Deep-Link, Telegram automatisch über die Queue (Worker sendet nach Freigabe), Instagram/Signal/Messenger/WeChat/Discord per Chat-Link + Zwischenablage. Kanäle: Telegram, WhatsApp, Instagram, TikTok, Snapchat, WeChat, LINE, E-Mail, SMS, Signal, Messenger, Discord.
- **Moments-Hub** (`/moments`): anstehende Geburtstage, vernachlässigte Kontakte (Verbindungs-Score), offene Meetups/Events, Asset Library.
- **Cron** `/api/cron/moments` (täglich 8:00): erzeugt Reminder für Geburtstage (≤3 Tage) und Kontaktpausen wichtiger Personen. Kein Autoversand — nur Reminder/Entwürfe, Freigabe bleibt manuell.

### Match-Score (Dating)

Jeder Kontakt bekommt einen Match-Score 0–100 aus dem Chat-Verlauf (`lib/scoring.ts`): Momentum (Pipeline-Stufe), Erwiderung (in/out-Balance), Aktualität, Antworttempo, Substanz. Als Badge in der Matchbox-Liste (sortierbar) und als Aufschlüsselung auf der Kontaktseite. Rein lokal berechnet, kein KI-Call.

### Foto-Check (Vision, Beuteschema)

Prüft ein Profilfoto gegen die im Beuteschema definierten Kriterien (`include`/`avoid`) via OpenAI-Vision. Beschreibt neutrale Merkmale, identifiziert keine realen Personen. Braucht `OPENAI_API_KEY`.
- **In-App**: Kontaktseite → Karte „Foto-Check" (URL einfügen oder Datei hochladen).
- **Extension**: Overlay-Knopf „📷 Foto prüfen" nimmt das größte sichtbare Profilbild.
- Nur Kriterien-Abgleich, kein Like — die Entscheidung bleibt beim Nutzer.

### KI-Verbrauch & Kosten-Limit

Jeder KI-Call (DeepSeek-Chat, OpenAI-Vision, Bild-Generierung) wird in `ai_usage` mit Token-Zahlen und Kostenschätzung geloggt. Einstellungen → „KI-Verbrauch & Kosten-Limit" zeigt Monatsverbrauch pro Provider mit Fortschrittsbalken und Monatslimit (Standard $10). Bei Erreichen des Limits blocken alle KI-Funktionen mit der Meldung „KI-Budget erreicht" — Limit erhöhen schaltet sie wieder frei. Preisschätzungen in `lib/ai/usage.ts` (bewusst konservativ).

### BookOS-Dispatch-Watchdog

- **Client** (Buchungsseite offen): prüft alle 10 s, ob alle Anbieter-Angebote abgelaufen sind, und startet automatisch eine neue Dispatch-Runde.
- **Cron** `/api/cron/dispatch`: räumt abgelaufene Angebote weg, dispatcht hängende Sofort-Buchungen neu und stößt fällige Terminbuchungen an (30 Min Vorlauf).
- **Takt**: Vercel Hobby erlaubt Crons nur **1×/Tag** (daher `0 6 * * *`). Für Minuten-Takt entweder Vercel Pro **oder** ein externer Cron (z. B. cron-job.org), der `GET /api/cron/dispatch` mit Header `Authorization: Bearer <CRON_SECRET>` jede Minute aufruft.

### KI-Bilder & automatischer Geburtstagsversand

- **Bild erzeugen**: Moments-Generator hat neben „Prompt" den Button „Bild erzeugen" — malt direkt via OpenAI Images (`gpt-image-1`), speichert in Supabase Storage (`moment-images`), zeigt Vorschau, legt Asset an. Braucht `OPENAI_API_KEY` in Vercel.
- **Auto-Geburtstagsgruß**: Cron `/api/cron/moments` (täglich 8:00) erkennt Geburtstag heute; hat der Kontakt einen Telegram-Kanal, erzeugt es Gruß-Text (+ Bild, falls `OPENAI_API_KEY`) und legt eine **Telegram-Suggestion mit Bild** in die Queue. Autopilot-Kontakte (`auto_mode`) senden nach Veto-Frist automatisch, sonst nach manueller Freigabe. Der Worker sendet **Foto + Bildunterschrift** (`sendFile`).
- **Automatischer Bildversand** geht nur über Telegram (eigener Account, Veto-gesichert) — andere Kanäle erlauben kein Anhängen per Deep-Link.
- Ohne `OPENAI_API_KEY`: Text-Gruß läuft automatisch, Bild bleibt Prompt + manueller Upload.

Env für Bilder: `OPENAI_API_KEY` (oder `IMAGE_API_KEY`) in Vercel. Storage-Bucket `moment-images` ist bereits angelegt (public).

## BookOS — On-Demand-Treatments (PWA)

Uber-artige Echtzeit-Buchung von Wellness-Treatments (`/book`). Eigenes Produkt im Nav-Dropdown (MatchOS · Moments · BookOS).

- **Buchen** (`/book`): Treatment aus Katalog wählen, Adresse per OpenStreetMap-Geocoding (Nominatim, kein Key), „jetzt" oder Termin, Notiz/Telefon.
- **Dispatch**: Bei Sofort-Buchung fragt das System die nächsten Online-Anbieter im Umkreis an (PostGIS `nearby_providers`, nach Distanz + Rating). Jeder bekommt ein Angebot mit Ablauffrist (`BOOKOS_OFFER_TTL`, Default 45 s). **Erster Accept gewinnt** — atomar über die RPC `accept_offer`.
- **Live-Status** (`/book/bookings/[id]`): Fortschrittsleiste (requested→…→completed), Leaflet-Karte mit Kunden- + Anbieter-Position, ETA aus Distanz, Rechnung, Storno, Bewertung nach Abschluss. Aktualisiert sich per Supabase-Realtime.
- **Anbieter** (`/provider`): online/offline-Toggle (teilt Live-Standort per Geolocation-Watch), eingehende Anfragen mit Countdown, Annehmen/Ablehnen, Statusführung (Losfahren→Angekommen→Start→Abschluss), Navigations-Deep-Link.
- **Preis**: Treatment-Basispreis + gestaffelte Anfahrtspauschale (0–15 € nach km).
- **Zahlung**: Stripe (manual capture — Autorisierung bei Match, Einzug bei Abschluss, Refund bei Storno). Ohne `STRIPE_SECRET_KEY` läuft alles im **Testmodus** (Buchung wird als `test` beglichen markiert).
- **Bewertung**: beidseitig vorbereitet, Kundenbewertung fließt in den Anbieter-Durchschnitt.

Env für BookOS: `STRIPE_SECRET_KEY` (optional, sonst Testmodus). PostGIS ist in Supabase aktiviert; Demo-Treatments + zwei Demo-Anbieter (Berlin) sind geseedet.

### PWA & Push

- Installierbar (Manifest + Service Worker + Offline-Seite). Auf dem Handy „Zum Home-Bildschirm".
- Web Push (VAPID): Einstellungen → Push aktivieren. Crons (Geburtstage, neue Follow-up-Entwürfe) und später Buchungsstatus benachrichtigen aufs Gerät. Env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (in Vercel gesetzt).

## Deploy (Vercel)

Repo importieren, Env-Variablen `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DEEPSEEK_API_KEY` setzen. Der Telegram-Worker läuft nicht auf Vercel — lokal oder auf einem kleinen Server starten.

## Architektur

- `src/lib/database.types.ts` — generierte Supabase-Typen + Pipeline-Konstanten
- `src/lib/actions.ts` — Server Actions (CRUD)
- `src/lib/ai/` — DeepSeek-Client, `generateReplies`, `summarize`, `analyzeStage`
- `src/app/api/ai/*` — KI-Endpunkte; `src/app/api/dates/[id]/ics` — Kalender-Export
- `worker/telegram.ts` — gramjs-Worker (Empfang + Senden freigegebener Entwürfe)

Datenbank: `contacts`, `contact_channels`, `messages`, `memories`, `conversation_summaries`, `suggestions` (Freigabe-Queue), `followups`, `dates`, `settings`. RLS aktiv, Zugriff nur authentifiziert (Single-User — deshalb bewusst `using (true)`).

## Roadmap (nächste Ausbaustufe)

Match-Scoring, automatische Follow-up-Vorschläge im Hintergrund, WhatsApp/Instagram-Anbindung, Browser-Assistenz für Dating-Apps, Google-Calendar-Auto-Eintrag, Autopilot-Modus mit Limits.
