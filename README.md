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
