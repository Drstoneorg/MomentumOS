# CLAUDE.md — Arbeitsregeln für dieses Repository

MomentumOS: Single-User-Plattform (Next.js 16 App Router, React 19, TypeScript, Tailwind v4,
Supabase, Vercel). Überblick in `README.md`, vollständige Funktionsliste und Workflows in
`FUNKTIONSKATALOG.md`, Sicherheitslage in `SECURITY-AUDIT.md`, priorisierte nächste Schritte
in `ROADMAP-FABLE.md`, Backups in `BACKUP.md`.

## Nicht verhandelbare Produktregeln

- **Nichts sendet sich selbst.** Jede generierte Nachricht ist ein Entwurf und braucht eine
  Einzel-Freigabe (Queue, Fokus, Telegram-Button). Kein Feature darf das aufweichen.
- **TradingOS ist strikt Papier.** Kein Broker, keine Orders, keine Anlageberatung.
- **RecruitOS ist Inbound-only.** Kein Scraping, keine Massen-DMs, OnlyFans nie automatisiert,
  18+ mit ID-Check und TFP/Model-Release als Pflicht.
- **Crons sind fail-closed**: ohne `CRON_SECRET` antworten sie 503. Jeder neue Cron ruft
  außerdem `beatCron()` (Heartbeat-Watchdog).

## Sicherheitsannahmen (brechen = Datenleck)

- **Es gibt genau EINEN Account.** Alle RLS-Policies sind `owner_all … to authenticated
  using (true)` — jeder weitere Account sähe alles. Nie einen zweiten Nutzer anlegen;
  Multi-User wäre ein Policy-Rewrite.
- **`createAdminClient()` (Service-Role) nie in Client-Komponenten** — nur in Crons,
  Webhooks und öffentlichen Token-Routen.
- **Muster für öffentliche Seiten** (`/model`, `/einladung/[token]`, `/e/[slug]`,
  `/tuer/[token]`): Middleware-Ausnahme + `robots: noindex` + Admin-Client-Lookup +
  neutrale Fehlermeldung ohne Datenpreisgabe + Rate-Limit; Formulare zusätzlich Honeypot
  und Consent-Pflicht.
- Rotierbare Tokens (Extension, Telegram, Webhooks, Kalender) liegen bewusst in der
  `settings`-Tabelle (RLS-geschützt), nicht in Env-Vars — Rotation ohne Deploy.

## Code-Konventionen

- Server-Actions geben `{ error }` zurück statt zu werfen; UI zeigt die Meldung.
- **`src/lib/database.types.ts` nie von Hand editieren** — `npm run types:gen` (braucht
  `SUPABASE_ACCESS_TOKEN`). Enum-Erweiterungen brauchen eine **eigene Migration vor** der
  ersten Nutzung der neuen Werte.
- `src/lib/dbLabels.ts` ist ein exhaustives Record über Enums — neuer Enum-Wert ohne Label
  ist ein gewollter Compile-Fehler.
- **Neue Tabelle = drei Orte**: Migration + `TABLES` in `src/app/api/backup/route.ts` +
  `ORDER` in `scripts/restore-backup.mjs`.
- Zeiten: DB speichert UTC; Nutzer-Logik rechnet über den Wien-Kalendertag
  (`Intl.DateTimeFormat`, `Europe/Vienna`) — siehe `sendezeit.ts`, `eventKonflikte.ts`.
- `react-hooks/purity`: kein `Date.now()`/`new Date()` im Komponenten-Render — Helfer auf
  Modul-Ebene extrahieren.
- KI-Textstil ist deterministisch nachgeschärft: `enforceStyle()` entfernt Binde-/
  Gedankenstriche und Satzend-Punkte; das Wort „höflich" ist in Prompts verboten.
- Nutzereingaben in PostgREST-`or()`-Filtern immer um `[,()%]` bereinigen (Muster in
  `src/app/search/page.tsx`).

## Arbeitsablauf

- Verifikation vor jedem Push: `npx tsc --noEmit` && `npx eslint .` && `npm test` &&
  `npm run build`; bei UI-/Routen-Änderungen zusätzlich `npm run test:e2e`
  (braucht `E2E_EMAIL`/`E2E_PASSWORD` in `.env.local`).
- **Playwright-Artefakte bleiben in `.pwtmp/`** (gitignored). Nie `git add -A` nach
  Testläufen — Screenshots können echte personenbezogene Daten zeigen, das Repo ist
  öffentlich. Dateien einzeln stagen.
- Commits: Deutsch, `feat:`/`fix:`/`chore:`/`test:`/`ci:`/`docs:`-Präfixe, keine
  KI-Attribution, keine Klarnamen.
- Migrationen laufen über das Supabase-MCP (`apply_migration`) gegen Projekt
  `ddxfegugjxsyhvntnqpn`; danach Types regenerieren (sonst schlägt der geplante
  Drift-Check an).
- CI (`.github/workflows/ci.yml`) läuft mit Dummy-Env — Code darf Env-Vars erst zur
  Laufzeit lesen, nie beim Import auswerten.
