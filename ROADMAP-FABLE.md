# ROADMAP-FABLE — 20 Code-Konzepte + 10 manuelle Aufgaben

Stand: 2026-08-08. Priorisiert nach Aufwand-Nutzen (Quick Wins zuerst, dann mittel, dann groß).
Jedes Konzept endet mit einem fertigen Prompt für eine zukünftige Claude-Code-Session —
Prompt kopieren reicht. Vorher immer: `CLAUDE.md` und `FUNKTIONSKATALOG.md` gelten.

---

## Teil 1 — 20 Code-Konzepte

### 1. Push-Benachrichtigung bei neuer Zusage / Bewerbung / Lead — **S** — ✅ umgesetzt (R32, 2026-08-08)
Web-Push (VAPID) ist fertig verdrahtet, aber nur Crons nutzen es. Die drei öffentlichen
Einläufe (`/api/rsvp`, `/api/apply`, `/api/event-lead`) sollen nach erfolgreichem Schreiben
eine Push-Nachricht schicken — das sind genau die Momente, in denen man es sofort wissen will.
**Dateien:** `src/app/api/rsvp/route.ts`, `src/app/api/apply/route.ts`,
`src/app/api/event-lead/route.ts`, `src/lib/push.ts`
> **Prompt:** In MomentumOS (`~/Projects/MatchOS`) sende bei erfolgreichem RSVP (ja/nein/
> Warteliste), neuer Model-Bewerbung und neuem Event-Lead eine Web-Push-Nachricht über die
> bestehende `src/lib/push.ts` an alle `push_subscriptions` (kurzer deutscher Titel + Name).
> Fehler beim Push dürfen die Route nie scheitern lassen (fire-and-forget mit catch).
> Unit-Test für den Nachrichtentext, tsc+lint+tests grün, ein Commit.

### 2. Schema-Drift-Check in CI — **S** — ✅ umgesetzt (R32, 2026-08-08)
`database.types.ts` ist generiert; vergisst eine Session nach einer Migration das
Regenerieren, merkt es niemand. Ein CI-Schritt, der die Datei gegen einen Hash der letzten
Generierung prüft (oder bei gesetztem `SUPABASE_ACCESS_TOKEN` frisch generiert und difft),
macht Drift zum roten Build.
**Dateien:** `.github/workflows/ci.yml`, `scripts/gen-types.mjs`
> **Prompt:** Baue in MomentumOS einen CI-Schritt „Types-Drift": Script
> `scripts/check-types-drift.mjs`, das `src/lib/database.types.ts` mit einem im Repo
> gepflegten SHA-256 (`scripts/types.hash`) vergleicht und bei Abweichung mit klarer
> Meldung fehlschlägt („npm run types:gen ausführen und Hash aktualisieren").
> `npm run types:gen` soll den Hash automatisch mitschreiben. In `ci.yml` einhängen.

### 3. Fehlergruppen-Signal aus der Telemetrie — **S** — ✅ umgesetzt (R32, 2026-08-08)
Browser-Fehler landen seit R28 in `client_errors`, aber niemand schaut hinein. Gruppieren
nach Message-Fingerprint und ab N Vorkommen in 24 h ein Cockpit-Signal erzeugen — damit
zahlt sich die Telemetrie endlich aus.
**Dateien:** `src/lib/signals.ts`, neue Query; Anzeige läuft automatisch über Inbox/Dashboard
> **Prompt:** In MomentumOS: erweitere `src/lib/signals.ts` um ein Signal „Browser-Fehler
> häufen sich": `client_errors` der letzten 24 h nach normalisierter Message gruppieren
> (Zahlen/UUIDs/URLs durch Platzhalter ersetzen), ab 3 Vorkommen ein Signal Prio 2 mit
> Gruppe, Anzahl und jüngstem Zeitstempel. Normalisierung als exportierte Funktion mit
> Unit-Test in `tests/`.

### 4. Daten-Export je Modul (JSON/CSV) — **S** — ✅ umgesetzt (R32, 2026-08-08)
Es gibt nur das verschlüsselte Voll-Backup und den Gästelisten-CSV. Ein Export-Knopf in
`/settings` pro Modul (Kontakte, Nachrichten, Jobs, Events, Trades) schließt die
DSGVO-Auskunftslücke und macht Daten portabel.
**Dateien:** neue Route `src/app/api/export/route.ts`, `src/app/settings/page.tsx`
> **Prompt:** Baue in MomentumOS einen authentifizierten Export: `GET /api/export?modul=
> kontakte|nachrichten|jobs|events|trading&format=json|csv` (Session-Auth wie andere
> API-Routen, Streaming nicht nötig, `Content-Disposition` attachment). CSV mit
> Kopfzeile, UTF-8-BOM für Excel. In `/settings` eine Export-Karte mit den fünf Modulen.
> E2E-Spec: Route ohne Login antwortet 401.

### 5. `middleware.ts` → `proxy.ts` migrieren — **S** — ✅ umgesetzt (R32, 2026-08-08)
Seit Next 16.3 ist die middleware-Konvention deprecated (Build-Warnung). Der offizielle
Codemod erledigt die Umbenennung; danach Verhalten verifizieren, bevor eine spätere
Next-Version sie entfernt.
**Dateien:** `src/middleware.ts` → `src/proxy.ts`
> **Prompt:** In MomentumOS `npx @next/codemod@canary middleware-to-proxy .` ausführen,
> Diff prüfen (Auth-Redirects und die öffentlichen Pfade /login, /model, /einladung, /e/,
> /tuer/ müssen unverändert funktionieren), Build ohne Deprecation-Warnung, alle 16 E2E
> grün, ein Commit.

### 6. Rate-Limiter atomar machen — **S** — ✅ umgesetzt (R32, 2026-08-08)
`rateLimitOk()` zählt per Read-then-Write — zwei parallele Requests können sich am Limit
vorbeimogeln. Eine Postgres-Funktion (`insert … on conflict … returning`) macht das Fenster
atomar; bei öffentlichen Endpunkten zählt das.
**Dateien:** neue Migration (RPC `bump_rate_limit`), `src/lib/rateLimit.ts`
> **Prompt:** In MomentumOS: SQL-Funktion `bump_rate_limit(p_bucket text, p_limit int,
> p_window_minutes int) returns boolean` (security definer, atomarer Upsert mit
> Fenster-Reset und Zähler-Check in einem Statement), Migration über Supabase-MCP anwenden,
> `rateLimitOk()` auf `rpc()` umstellen, Signatur beibehalten. `npm run types:gen` nicht
> vergessen. Bestehende Aufrufer unverändert. Unit-Test der SQL-Logik als pgTAP ist nicht
> nötig — ein Kommentar mit dem Concurrency-Argument reicht.

### 7. RecruitOS Onboarding-Checkliste — **S**
Pro Model die Pflichtpunkte als Checkliste am Datensatz: Alter/ID geprüft, TFP unterschrieben,
Model-Release, Kontaktkanal verifiziert. Verhindert, dass ein Shooting ohne Papierkram
stattfindet — die ethischen Leitplanken werden Software.
**Dateien:** Migration (`recruit_applications` + jsonb-Spalte `onboarding`), `src/app/recruit/[id]/`-Ansicht
> **Prompt:** In MomentumOS: `recruit_applications` bekommt `onboarding jsonb default '{}'`
> (Migration + types:gen). Auf der Bewerbungs-Detailseite eine Checkliste mit vier festen
> Punkten (ID-Check 18+, TFP unterschrieben, Model-Release, Kanal verifiziert), Häkchen
> speichert Zeitstempel. Kanban-Karte zeigt „3/4"-Badge; Stage-Wechsel auf „Shooting
> geplant" warnt, solange nicht alle vier gesetzt sind (nur Warnung, keine Sperre).

### 8. Sendezeit-gesteuerte Queue-Sortierung — **S**
Die Sendezeit-Muster pro Kontakt (R31) stehen bisher nur als Chips im Einladungs-Assistenten.
Die Queue könnte Entwürfe, deren Kontakt „jetzt gerade" sein Antwortfenster hat, nach oben
sortieren — mehr Antworten für null zusätzliche Arbeit.
**Dateien:** `src/app/queue/page.tsx`, `src/lib/sendezeit.ts`
> **Prompt:** In MomentumOS: nutze `sendezeitProKontakt` aus `src/lib/sendezeit.ts` in der
> Queue-Seite. Entwürfe, deren Kontakt-Sendezeitfenster (Wochentag+Tageszeit, Wien-Zeit)
> jetzt aktiv ist, bekommen einen „🕐 gutes Fenster"-Chip und werden bei gleicher Priorität
> zuerst gelistet. Reine Lese-Logik, kein Auto-Versand. Modul-Level-Helfer statt
> `Date.now()` im Render (react-hooks/purity).

### 9. Health-Dashboard `/status` — **M** — ✅ umgesetzt (R32, 2026-08-08)
Eine Seite mit allem Betriebszustand: 7 Cron-Heartbeats mit Ampel, letzte Backup-Zeit,
Fehlergruppen, KI-Kosten des Monats gegen Budget, Rate-Limit-Auslastung, Storage-Größe.
Heute ist das über Dashboard-Signale, Settings und SQL verstreut.
**Dateien:** neue `src/app/status/page.tsx`, Queries aus `signals.ts`/`usage.ts` wiederverwenden
> **Prompt:** Baue in MomentumOS `/status` (Session-geschützt, in Nav unter Einstellungen
> verlinken): Karten für (a) alle `cron_heartbeat_*` aus `settings` mit Ampel gegen
> `CRON_MAX_AGE_HOURS`, (b) KI-Kosten Monat aus `ai_usage` gegen `settings.ai_budget`,
> (c) `client_errors` 7 Tage gruppiert, (d) Zeilenzahlen der 10 größten Tabellen,
> (e) `rate_limits`-Buckets über 80 %. Reine Lese-Seite, `dynamic = "force-dynamic"`,
> bestehende Card-Komponenten aus `src/components/ui.tsx`.

### 10. RLS-Test-Suite — **M**
Die Sicherheitsannahme „anon kommt nirgends rein" ist heute nur durch Advisors und Handarbeit
gedeckt. Ein Vitest-Lauf, der mit dem echten Anon-Key jede Tabelle liest/schreibt und 0 Zeilen
bzw. Fehler erwartet, macht die Annahme dauerhaft prüfbar.
**Dateien:** neuer `tests/rls.test.ts` (env-gated, läuft nur mit gesetzten Keys), CI optional
> **Prompt:** In MomentumOS: schreibe `tests/rls.test.ts`, das mit
> `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (aus `.env.local`, via
> dotenv wie in `playwright.config.ts`) für JEDE Tabelle aus `src/app/api/backup/route.ts`
> (TABLES-Liste importieren) prüft: `select` liefert 0 Zeilen, `insert` einen Fehler.
> Ohne gesetzte Env-Vars: `describe.skip` mit Hinweis. Nicht in die normale `npm test`-
> Pipeline zwingen — eigenes Script `npm run test:rls`.

### 11. Signierte Storage-URLs statt public Buckets — **M** (Security H3)
`avatars` und `moment-images` sind öffentlich; dort liegen Fotos Dritter. Umbau auf private
Buckets + `createSignedUrl` (Anzeige) bzw. serverseitiges Durchreichen (Telegram-Versand).
Schließt den Datenschutz-Fund H3 aus `SECURITY-AUDIT.md`.
**Dateien:** `src/lib/storage.ts`, Avatar-/Karten-Anzeige, `worker/telegram.ts`, Bucket-Umstellung dokumentieren
> **Prompt:** In MomentumOS: stelle die Nutzung der Buckets `avatars` und `moment-images`
> auf signierte URLs um (Supabase `createSignedUrl`, 1 h TTL): zentrale Helfer in
> `src/lib/storage.ts`, alle Anzeige-Stellen (Avatar-Komponente, Karten-Galerie,
> Kontaktseite) und der Telegram-Worker holen URLs nur noch signiert. Die eigentliche
> Bucket-Umstellung auf private (`update storage.buckets set public=false`) NUR als
> dokumentierten SQL-Schritt in `SECURITY-AUDIT.md` ergänzen, nicht selbst ausführen —
> erst wenn der Code deployt ist. In `contacts.avatar_url` gespeicherte absolute URLs
> auf Pfad-only migrieren (Migration + Backfill).

### 12. Restore-Drill automatisiert — **M**
Backups ohne geprobten Restore sind Hoffnung, kein Schutz. Ein Skript, das ein Backup gegen
eine Supabase-Branch-Datenbank einspielt und Zeilenzahlen vergleicht, macht den Ernstfall
zur Routine. (Setzt voraus, dass K1 behoben ist und Backups existieren.)
**Dateien:** `scripts/restore-drill.mjs`, `BACKUP.md`
> **Prompt:** In MomentumOS: schreibe `scripts/restore-drill.mjs`, das ein Backup-JSON
> nimmt, gegen eine über Env (`DRILL_SUPABASE_URL`, `DRILL_SERVICE_ROLE_KEY`) angegebene
> ZWEIT-Datenbank `scripts/restore-backup.mjs` ausführt und danach je Tabelle die
> Zeilenzahl Backup vs. Ziel-DB vergleicht (Abweichung = Exit 1, klare Tabelle im
> Output). Sicherung: Skript verweigert, wenn `DRILL_SUPABASE_URL` die Produktions-URL
> aus `NEXT_PUBLIC_SUPABASE_URL` ist. `BACKUP.md` um den Drill-Ablauf ergänzen.

### 13. Telegram-Bot-Befehle `/heute` `/queue` `/stats` — **M**
Der Webhook kann bisher nur Inline-Buttons. Drei Lese-Befehle machen den Bot zur
Fernbedienung: Tagesübersicht, offene Queue-Zahl mit Kurzliste, Wochen-Kennzahlen.
**Dateien:** `src/app/api/telegram/webhook/route.ts`, `src/lib/telegramBot.ts`, `src/lib/telegramCallbacks.ts`
> **Prompt:** In MomentumOS: erweitere den Telegram-Webhook um Text-Befehle `/heute`
> (heutige Signale gruppiert, max 15 Zeilen), `/queue` (Anzahl + erste 5 Entwürfe mit
> Kontaktname) und `/stats` (Antwortquote 7 Tage, Zusagen nächstes Event, Jobs neu).
> Nur für die gebundene `telegram_chat_id`, alles andere ignorieren. Antworten über die
> bestehende Bot-Send-Funktion, reine Lese-Operationen, Unit-Test für die Formatierung.

### 14. Passwort-Reset + TOTP-2FA — **M**
Ein Account mit Vollzugriff auf ein ganzes Leben, aber ohne Reset-Flow und zweiten Faktor.
Supabase liefert beides (Reset-Mail, MFA/TOTP) — es fehlt nur UI.
**Dateien:** `src/app/login/page.tsx`, neue `src/app/login/reset/page.tsx`, `/settings`-Karte für MFA
> **Prompt:** In MomentumOS: baue (a) „Passwort vergessen" auf `/login` →
> `resetPasswordForEmail` mit Redirect auf neue Seite `/login/reset` (Passwort neu setzen
> über `updateUser`), (b) in `/settings` eine MFA-Karte: TOTP-Faktor anlegen (`mfa.enroll`,
> QR anzeigen), verifizieren, entfernen; Login fragt bei aktiver MFA den Code ab
> (`mfa.challenge`/`verify`). Supabase-JS-v2-APIs, deutsche Texte, E2E-Spec: /login/reset
> rendert ohne Session.

### 15. Pretix-Anbindung konkret — **M**
Der generische Ticket-Webhook wartet auf einen echten Anbieter. Pretix (selbst gehostet oder
pretix.eu) sendet Order-Webhooks; Mapping auf `status: ticket` + Promo-Code-Abgleich liegt
schon bereit. (Setzt ein Pretix-Konto voraus — manuelle Aufgabe 6.)
**Dateien:** `src/app/api/tickets/webhook/route.ts`, evtl. `src/lib/promo.ts`
> **Prompt:** In MomentumOS: erweitere `/api/tickets/webhook` um ein Pretix-Payload-Format
> (`action: pretix.event.order.paid`, Positions-E-Mail/Name/Voucher): Zuordnung zum
> Kontakt über E-Mail oder Promo-Code (bestehende Logik wiederverwenden), Invite-Status
> auf `ticket`. Format-Erkennung an der Payload-Struktur, bestehendes generisches Format
> bleibt. Unit-Tests mit zwei Beispiel-Payloads (paid + canceled → Status zurück auf yes).

### 16. TradingOS Trade-Journal + Risiko-Kennzahlen — **M**
These je Trade existiert; es fehlen die Lern-Kennzahlen: Trefferquote, Profit-Faktor, max
Drawdown, Halte-Dauer, Performance je These-Kategorie. Papier bleibt Papier — es geht ums
Messen, nicht ums Handeln.
**Dateien:** `src/lib/trading.ts`, `src/app/trading/page.tsx`, `tests/trading.test.ts`
> **Prompt:** In MomentumOS (`TradingOS ist strikt Papier — kein Broker, keine Orders`):
> berechne in `src/lib/trading.ts` aus `paper_trades` Kennzahlen Trefferquote, Profit-
> Faktor, maximaler Drawdown der Equity-Reihe, mittlere Halte-Dauer, Rendite je
> These-Tag. Auf `/trading` als Kennzahlen-Karte unter der Equity-Kurve, jede Zahl mit
> Ein-Satz-Erklärung. Reine Mathematik mit Unit-Tests (mind. 6 Fälle inkl. leerer Historie).

### 17. KI-Kosten je Funktion auswerten — **S**
`ai_usage` loggt jeden Aufruf; eine Auswertung nach Zweck (Antwort-Entwurf, jobscan, Ask,
Karten …) zeigt, wo das Budget wirklich hingeht, und macht Sparhebel sichtbar.
**Dateien:** `src/lib/ai/usage.ts`, `/settings`- oder `/status`-Karte
> **Prompt:** In MomentumOS: `ai_usage` nach `feature`-Feld (falls das Feld fehlt: Migration
> `feature text`, alle `logUsage`-Aufrufer in `src/lib/ai/` mit ihrem Feature-Namen
> nachrüsten) über 30 Tage aggregieren: Aufrufe, Tokens, Kosten, Anteil. Anzeige als
> Tabelle in `/settings` unter dem Budget. Absteigend nach Kosten.

### 18. Zeitzone zentralisieren — **M**
`Europe/Vienna` ist in mehreren Libs fest verdrahtet (sendezeit, eventKonflikte, Anzeigen).
Eine zentrale Konstante + Helfer (`wienTag()`, `wienStunde()`) macht einen späteren Umzug
oder Reisen-Modus zur Ein-Zeilen-Änderung.
**Dateien:** neue `src/lib/zeit.ts`, Aufrufer in `sendezeit.ts`, `eventKonflikte.ts`, Seiten
> **Prompt:** In MomentumOS: lege `src/lib/zeit.ts` mit `export const APP_TZ =
> "Europe/Vienna"` und Helfern `kalenderTag(iso)`, `wochentagUndStunde(iso)` (Intl-basiert)
> an; stelle `sendezeit.ts`, `eventKonflikte.ts` und direkte `toLocaleString("de-DE")`-
> Stellen mit Zeitzonen-Relevanz darauf um. Verhalten identisch (Tests dürfen sich nicht
> ändern), reine Refaktorierung, Unit-Test für beide Helfer.

### 19. Lokale Supabase für E2E — **L**
Die E2E-Suite läuft gegen die Dev-DB mit Livedaten — Statuscodes öffentlicher Routen und
Schreib-Flows sind nur eingeschränkt testbar. `supabase start` (Docker) + Seed-Skript +
eigener `.env.test` machen die Suite hermetisch und erlauben harte Assertions.
**Dateien:** `supabase/config.toml` (neu via CLI), `scripts/seed-e2e.mjs`, `playwright.config.ts`, CI
> **Prompt:** In MomentumOS: richte lokale Supabase für E2E ein: `supabase init` +
> Migrations-Export der 43 Migrationen aus dem Remote-Projekt (MCP `list_migrations`),
> Seed-Skript mit einem Testnutzer + 3 Kontakten + 1 Event mit Invite-Token,
> `playwright.config.ts` liest `.env.test` wenn `E2E_LOCAL=1`. Erweitere danach
> `e2e/kernflows.spec.ts` um harte Statuscode-Asserts (RSVP mit gültigem Token 200 +
> DB-Effekt, Tür-Checkin setzt attended). CI-Job optional (Docker-Service), lokal Pflicht.

### 20. pgvector-Gedächtnis-Suche — **L**
Das Gedächtnis (`memories`) wächst; ilike findet nur Wortgleichheit. Embeddings (pgvector +
kleines Embedding-Modell) machen „was mag sie nochmal?" semantisch findbar — als Werkzeug im
Frage-Chat und in der Kontaktseite.
**Dateien:** Migration (Extension + Spalte + Index), `src/lib/ai/`-Embedding-Client, Ask-Werkzeug
> **Prompt:** In MomentumOS: aktiviere pgvector (Migration: Extension in Schema
> `extensions`, `memories.embedding vector(1024)`, HNSW-Index), Embedding-Erzeugung beim
> Anlegen/Ändern von memories (kleines Embedding-Modell über den vorhandenen
> OpenAI-Client, env-gated hinter `OPENAI_API_KEY`, Kosten über `ai_usage` loggen),
> Backfill-Skript, neues Ask-Werkzeug `gedaechtnis_suche(frage)` mit Top-8-Treffern
> (RPC mit `<=>`-Distanz). Ohne Key: Werkzeug nicht registrieren (Muster AirbnbWorker).

---

## Teil 2 — 10 manuelle Aufgaben (nur der Mensch kann sie)

### 1. `BACKUP_SECRET` setzen — **DRINGENDSTE AUFGABE**
- [ ] `openssl rand -hex 32` ausführen, Wert in den Passwort-Manager
- [ ] vercel.com → Projekt `momentumos-hq` → Settings → Environment Variables → `BACKUP_SECRET` anlegen → Redeploy
- [ ] github.com/Drstoneorg/MomentumOS → Settings → Secrets and variables → Actions → `BACKUP_SECRET` anlegen
- [ ] Actions → „DB Backup" → Run workflow → Lauf grün? Artifact da?

### 2. Restore einmal proben
- [ ] Frisches Backup-Artifact herunterladen
- [ ] Nach `BACKUP.md` entschlüsseln + entpacken
- [ ] Mindestens: JSON öffnen, `table_count` und Stichproben-Zeilen prüfen
- [ ] Ideal: gegen eine Supabase-Branch-DB zurückspielen (siehe Konzept 12)

### 3. Screenshot aus der Git-Historie tilgen
- [ ] Anleitung in `SECURITY-AUDIT.md` → H2 Schritt für Schritt (git-filter-repo + Force-Push)
- [ ] Danach alle lokalen Klone neu ziehen
- [ ] Optional GitHub-Support wegen gecachter Objekte

### 4. Supabase-Auth härten
- [ ] supabase.com/dashboard/project/ddxfegugjxsyhvntnqpn → Authentication → Leaked password protection AN
- [ ] Passwort auf langes Manager-Passwort wechseln
- [ ] SQL-Editor: die zwei Revoke-Blöcke aus `SECURITY-AUDIT.md` (M2 + N1) ausführen

### 5. GitHub-Repo-Hygiene
- [ ] Settings → Code security → Dependabot alerts + security updates AN
- [ ] Secret scanning + Push protection AN
- [ ] Repo-Description + Topics setzen (steht seit Wochen aus)

### 6. Vercel-Env-Entscheidungen
- [ ] `SHRINE_SERVICE_ROLE_KEY` setzen (Shrine-Event-Publish aktivieren) — oder Feature bewusst tot lassen
- [ ] `OPENAI_API_KEY` setzen, falls Foto-Check/Kartenbilder gewünscht
- [ ] Kontrolle: `CRON_SECRET`, `DEEPSEEK_API_KEY`, VAPID-Paar vorhanden?

### 7. Cron-Realität prüfen
- [ ] Dashboard `/` eine Woche beobachten: meldet der Watchdog stille Crons?
- [ ] vercel.com → Projekt → Settings → Cron Jobs: feuern alle 7? (Hobby-Plan-Limits!)
- [ ] Falls gedrosselt: Plan-Entscheidung treffen oder Crons konsolidieren

### 8. Telegram-Worker in Betrieb nehmen
- [ ] `npm run telegram:login` einmal durchlaufen (Session-String entsteht)
- [ ] `npm run worker:daemon` + `npm run worker:daemon:status`
- [ ] Testlauf: Entwurf in `/queue` freigeben → kommt er im Zielchat an?
- [ ] Bot-Webhook: Secret in `/settings` gesetzt?

### 9. RecruitOS rechtlich absichern
- [ ] TFP-Vertrag (Druckseite `/recruit/[id]/tfp`) von Anwalt prüfen lassen
- [ ] 18+/ID-Check-Prozess schriftlich festlegen (wer prüft was, wo wird es vermerkt)
- [ ] Model-Release-Aufbewahrung klären

### 10. DSGVO-Grundgerüst
- [ ] Lösch-Prozess für Drittdaten definieren (Papierkorb existiert — Frist + endgültiges Löschen dokumentieren)
- [ ] Auskunfts-Prozess: welcher Export deckt eine Anfrage ab? (Konzept 4 hilft)
- [ ] Foto-Einwilligungen: welche Bilder Dritter liegen in den Buckets, welche dürfen bleiben?
