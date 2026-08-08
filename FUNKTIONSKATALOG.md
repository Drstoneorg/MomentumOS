# Funktionskatalog — MomentumOS

Stand: 2026-08-08 (nach Runde 31). Vollständige Funktionsliste, Bedienung, Kern-Workflows,
bewusste und vergessene Lücken, plus Rumsfeld-Analyse. Zielgruppe: jede zukünftige Session
(Mensch oder Modell), die ohne Vorwissen weiterarbeiten soll.

Produktions-URL: `https://momentumos-hq.vercel.app` · Supabase-Projekt: `ddxfegugjxsyhvntnqpn`
· Ein einziger Nutzer-Account (Single-User-System, kein Onboarding).

---

## 1. Plattform-Querschnitt (alle Module)

| Funktion | Ein Satz | Nutzung |
|---|---|---|
| Login | E-Mail+Passwort über Supabase Auth, „Angemeldet bleiben" verlängert die Session. | `/login` |
| Dashboard | Bento-Kacheln mit den wichtigsten Signalen, Sparklines und Equity-Snapshot aller Module. | `/` |
| Signal-Engine | Eine Quelle (`src/lib/signals.ts`) fragt alle Module ab und erzeugt einen priorisierten Feed; jedes Signal trägt seine Aktion. | speist `/`, `/inbox`, `/focus`, Telegram |
| Inbox | Alle Signale gruppiert mit Aktionen und Snooze pro Signal. | `/inbox` |
| Fokus-Modus | Signale als Karten, eine nach der anderen, Tastatur-getrieben. | `/focus` |
| Freigabe-Queue | Jeder KI-Entwurf wartet hier; `j`/`k` bewegen, `Enter` freigeben, `x` verwerfen; Batch-Modus beschleunigt, gibt aber nie alles auf einmal frei. | `/queue` |
| Command-Palette | Fuzzy-Suche über Seiten, Kontakte, Jobs, Artists, Events. | `⌘K` überall |
| Globale Suche | Volltext über Kontakte, Nachrichten, Gedächtnis, Jobs, Events. | `/search?q=…` oder Suchfeld in der Leiste |
| Frage-Chat | Fragen an die eigene Datenbank über ~25 Lese-Werkzeuge, Antwort gestreamt, ca. 0,2 Cent pro Frage. | `/ask` |
| Frage-Chat Schreibaktionen | Der Chat kann Aktionen VORSCHLAGEN (Kontakt anlegen, Notiz, RSVP setzen, Wiedervorlage); ausgeführt wird erst nach Klick auf die Bestätigungs-Karte. | `/ask` → Karte → „Ausführen" |
| Papierkorb | Gelöschte Kontakte samt 11 Kindtabellen als Schnappschuss, 30 Tage wiederherstellbar, danach räumt der Cron. | `/papierkorb` (auch über ⌘K) |
| Vorlagen-Editor | Einladungs-/Nachfass-Texte in der DB (Schlüssel/Sprache/Variante), Variante B gefüllt = A/B-Test, Antwortquote je Variante steht daneben. | `/vorlagen` |
| Erinnerungs-Engine | Generische Wiedervorlagen (`reminders`-Tabelle) mit Fälligkeitsdatum; fällige erscheinen als Cockpit-Signal Prio 1. | ⏰-Karte auf jeder Kontaktseite (+3/7/30 Tage) |
| Schnellerfassung | „+ Kontakt"-Button überall; Freitext-Zeile wird per KI in strukturierte Felder geparst. | Button in der Nav |
| Universal-Erfassung | Text, Screenshot (OCR per Vision) oder Link wird zu Kontakt+Kanälen; erkennt Duplikate. | `/capture`, auch vom Handy (PWA teilen) |
| vCard/CSV-Import | Datei-Upload mit Vorschau und Duplikat-Erkennung über Name+Kanal. | `/contacts` → Import |
| Dubletten-Merge | Erkennung ähnlicher Kontakte (pg_trgm) und Zusammenführen in einer DB-Transaktion. | `/contacts/dubletten` |
| Kontakt-Avatare | Foto-Upload pro Kontakt, liegt im Storage-Bucket `avatars`. | Kontaktseite → Avatar |
| PWA | Installierbar, Offline-Shell, Web-Push (VAPID). | Browser „Zum Homescreen", Push in `/settings` |
| Telegram-Bot | Morgen-Briefing und Wochen-Digest mit Inline-Buttons (erledigt/snooze/freigeben); Webhook per Secret-Token an genau eine Chat-ID gebunden. | einrichten in `/settings` |
| Telegram-Worker | Lokaler gramjs-Prozess, der NUR freigegebene Entwürfe versendet; läuft als launchd-Dienst auf dem Mac. | `npm run worker` bzw. `npm run worker:daemon` |
| Kalender-Feed | Abonnierbarer ICS-Feed (Dates, Events, Gigs, Meetups, Geburtstage, Interviews). | `/api/calendar?token=…` — Token in `/settings` |
| Fehler-Telemetrie | Browser-Fehler landen per `ErrorReporter` in `client_errors` (Rate-Limit 20/h/IP). | passiv; Auswertung per SQL oder `/ask` |
| Cron-Heartbeats | Jeder Cron schreibt seinen Zeitstempel; Dashboard warnt ab 36 h Stille (Watchdog gegen stumme Vercel-Cron-Ausfälle). | passiv, Signal auf `/` |
| Backups | `/api/backup` liefert Voll-Export (Bearer `BACKUP_SECRET`); GitHub Action zieht täglich, verschlüsselt als Artifact (90 Tage). | siehe `BACKUP.md` — **läuft aktuell NICHT, Secret fehlt** |
| Restore | `scripts/restore-backup.mjs` spielt ein Backup per Upsert zurück. | `node scripts/restore-backup.mjs backup.json` |
| Kosten-Guard | Jeder Modellaufruf wird mit Tokens+Kosten in `ai_usage` geloggt; Monatsbudget (`settings.ai_budget`) blockt weitere Aufrufe. | Verbrauch in `/settings` |
| Rate-Limits | DB-basierte Stundenfenster pro Bucket (überleben Serverless-Kaltstarts) auf allen öffentlichen und Extension-Routen. | passiv |
| Keepalive | Täglicher GitHub-Action-Ping auf `/api/keepalive` verhindert die 7-Tage-Pause des Supabase-Free-Tiers. | passiv |
| Typen-Generierung | `database.types.ts` ist 100 % generiert; nie von Hand editieren. | `npm run types:gen` (braucht `SUPABASE_ACCESS_TOKEN`) |
| Systemstatus | Crons-Ampel, KI-Kosten je Funktion, Fehlergruppen, Tabellen-Wachstum, Rate-Limit-Buckets auf einer Seite (R32). | `/status` (auch über ⌘K) |
| Daten-Export | Rohdaten je Modul (Kontakte, Nachrichten, Gedächtnis, Jobs, Events, Trading) als JSON oder CSV (R32). | `/settings` → 📦 Daten-Export oder `/api/export?modul=…&format=…` |
| Sofort-Push bei Einläufen | Neue Zusage/Absage/Warteliste, Model-Bewerbung und Event-Lead lösen eine Push-Nachricht aus (R32) — Push-Abo in `/settings` nötig. | passiv |

## 2. MomentOS — Freunde & Familie

| Funktion | Ein Satz | Nutzung |
|---|---|---|
| Personen-CRM | Kontakte mit Realm `moment`, Rhythmus („alle 3 Wochen"), Verbindungs-Score, Tags, Timeline. | `/moments/people`, `/contacts` |
| Kontakt-Rhythmus | „Zu lange still"-Signale, nach Beziehungsgewicht sortiert. | Cron `moments` 8:00 UTC → Signale |
| Geburtstage | 3 Tage Vorlauf, tägliche Erinnerung (aktualisiert statt stapelt), Batch-Gruß-Entwürfe. | Signal auf `/`; Batch-Button in `/moments` |
| Sammelkarten | KI-generierte Trading-Card-Andenken pro Person aus einer Fakten-Whitelist, über hochgeladenes Template gerendert, mit Versand-Archiv. | `/cards` |
| Meetups | Slot-Vorschläge, Teilnehmer-Status, Broadcast von Ort/Zeit, ICS, Nachbereitung ins Gedächtnis. | `/moments/meetups` |
| Ton-Offset | Pro Kontakt gelernte Tonanpassung für Entwürfe. | Kontaktseite |
| Archiv | 90-Tage-Auto-Archiv mit Kandidaten-Vorschau. | `/moments/archive` |

## 3. Event-Stack (MomentOS-Events, Runden 30–31)

| Funktion | Ein Satz | Nutzung |
|---|---|---|
| Events | Anlegen mit Datum, Ort, Kapazität, Ziel-Gästezahl, Zielpublikum, Budget. | `/moments/events` |
| Gast-Score | Kandidaten nach Passung (Stil, Ort, Historie, Feedback-Schnitt, Ermüdungsschutz) mit erklärenden Chips. | `/moments/events/[id]/einladen` |
| Einladungs-Wellen | Einladen in Wellen mit fertigen Entwürfen in der Queue; A/B-Variante wird mitgeschrieben. | Assistent → Auswahl → „Welle einladen" |
| Wellen-Wächter | Cron schlägt bei verfehltem Ziel ≤10 Tage vor Event eine fertige Nachlade-Welle vor (Banner: Übernehmen/Verwerfen, danach 3 Tage Ruhe). | passiv im Assistenten |
| Segmente | Kandidaten-Auswahl speichern/laden („Stammgäste", „Goth-Wien"). | Assistent → 💾 / 📁 |
| Sendezeit-Chips | „Meist Do abends" pro Kontakt aus 90 Tagen eingehender Nachrichten (Wien-Zeit). | Chips im Assistenten |
| Gäste-Mix | Zusagen nach Stadt und Kreis als Balken — zeigt Schieflagen früh. | Assistent-Kopf |
| No-Show-Mathe | Quote aus vergangenen Events plus Überbuchungs-Empfehlung (Kappe 60 %). | Assistent-Kopf |
| Nachfass | Wer 3+ Tage nicht antwortet, bekommt einen Nachfass-Entwurf (Sperre 4 Tage). | Assistent → Nachfass-Knopf |
| Chat-Zusagen-Erkennung | Extension-Sync erkennt „bin dabei"/„kann nicht" konservativ als Vermutung; Übernahme NUR per Klick. | Banner im Assistenten |
| RSVP-Seite | Öffentliche persönliche Zusage-Seite: Ein-Tap ja/nein, Begleit-Namen, Kommentar (wird Gedächtnis-Eintrag), DE/EN, ICS-Download, Einlass-QR. | `/einladung/[token]` — Link pro Gast im Assistenten kopieren |
| Warteliste | Volles Haus macht „ja" serverseitig zur Warteliste; Absage rückt den Ältesten nach (Entwurf in Queue). | automatisch ab gesetzter Kapazität |
| 1-Frage-Feedback | 6 h nach dem Event wird die RSVP-Seite zur Bewertungs-Karte (1–5 + Kommentar), fließt in den Gast-Score. | gleicher Link |
| Öffentliche Event-Seite | Lead-Funnel mit Lineup, Ticket-Link und „Will kommen"-Formular (Honeypot, Consent, Rate-Limit) → Kontakt mit Intent `event_lead`. | `/e/[slug]` — Slug auf der Event-Seite setzen |
| Tür-Modus | Handy-Check-in: ein Tap = anwesend, QR-Scan der Gast-Codes, Offline-Warteschlange für den Keller ohne Empfang. | Event-Seite → Tür-Modus |
| Türsteher-Link | Check-in-Ansicht ohne Login für eine zweite Person (Token in URL). | Tür-Modus → 🔗 Türsteher |
| Event-Nachbereitung | `attended` löst Gedächtnis-Eintrag, Follow-up und optional Dankes-Entwurf aus. | automatisch beim Abhaken |
| Promo-Fahrplan | Aufgaben-Checkliste T-42 bis T+1 pro Event, im Kalender-Feed. | Event-Seite |
| Budget + Break-even | Kostenposten je Event plus „ab X Tickets plus". | Event-Seite |
| Serien | Gleicher Serienname verbindet Ausgaben: Zusagen/Anwesende je Ausgabe, Wiederkehrer-Quote, Trend. | Event-Seite → Serienfeld |
| Klonen | Event +28 Tage duplizieren, Promo-Fahrplan neu, Gästelisten-Vorschlag aus dem letzten Mal. | Event-Seite → 🧬 |
| Konflikt-Wächter | Warnt bei zweitem Event am selben Wien-Tag und doppelt verplanten Artists. | Event-Seite |
| Gästeliste-CSV | Export mit Promo-Codes für die Tür. | Event-Seite |
| Zielpublikum-Passung | Score Event↔Artist über Zielpublikum-Tags. | Event-/Artist-Seite |

## 4. MatchOS — Kennenlernphase

| Funktion | Ein Satz | Nutzung |
|---|---|---|
| Kontakt-Pipeline | Kanban der Gespräche (Stages bis Archiv), Bulk-Aktionen. | `/pipeline` |
| Gedächtnis pro Person | Fakten/Notizen, die Kontext über Wochen tragen; Zusammenfassungen je Gespräch. | Kontaktseite |
| Antwort-Entwürfe | Mehrere Tonlagen, gelernter Stil, deterministische Stil-Regeln (keine Bindestriche, kein Satzend-Punkt). | Kontaktseite / Queue / Extension |
| Opener-Generator | Auto-Entwurf bei neuem Profil. | automatisch, landet in Queue |
| Versprechen-Erkennung | „Meld mich nächste Woche" wird per Regex zur datierten Wiedervorlage (kein Modellaufruf). | passiv |
| Ghosting-Radar | Verstummte Gespräche mit Reaktivierungs-Vorschlag. | Dashboard/Inbox |
| Outcome-Loop | Antwortquoten je Entwurfstyp fließen zurück in die Generierung. | passiv |
| Match-Score | Deterministischer Passungs-Score mit Badge. | Kontaktseite |
| Foto-Check | Vision-Analyse eines Profils/Fotos (env-gated, `OPENAI_API_KEY`). | Kontaktseite / Extension |
| Auto-Archiv | 90 Tage stumm = Archiv-Kandidat. | Cron `followups` |

## 5. JobOS — Jobsuche

| Funktion | Ein Satz | Nutzung |
|---|---|---|
| Nacht-Scan | Cron durchsucht Portale (Wien+Berlin), Dedupe über URL- und Firma+Titel-Fingerprint, Selbstheilung bei leeren Suchbegriffen. | Cron `jobscan` 6:30 UTC |
| Match-Score + Anschreiben | Score gegen gespeichertes CV-Profil; starke Treffer bekommen automatisch Anschreiben-Entwürfe. | `/jobs` |
| Ein-Klick-Bewerbung | mailto-Paket mit vorbefülltem Text. | Job-Karte |
| CV-Builder | Drei Layouts, fünf Akzentfarben, live umschaltbar, Druckansicht. | `/jobs/cv` |
| Interview-Prep | Fragen+Antworten aus dem Inserat generiert. | Job-Karte |
| Interview-Termin | Datum an der Bewerbung, erscheint im Kalender-Feed. | Job-Karte |
| Nachfass + Funnel | Signal nach 14 Tagen Stille; Funnel-Statistik je Quelle. | `/jobs` |
| Scraper-Gesundheit | Metrik je Portal — 0-Zeilen-Läufe fallen auf. | `/jobs` Kopfzeile |

## 6. BookOS — Artist-Booking & On-Demand

| Funktion | Ein Satz | Nutzung |
|---|---|---|
| Artist-CRM | Genres, Gagen, Kontakte, Verfügbarkeitskalender, Gig-Pipeline (Anfrage→bestätigt→gespielt). | `/book/artists` |
| Anfrage-Generator | KI-Anfrage-Entwurf pro Gig plus Follow-up-Signal bei Stille. | Artist-/Gig-Seite |
| Lineup + Vertrag | Lineup-Builder je Event und Vertrags-Druckseite. | `/book/gigs/[id]/contract` |
| On-Demand-Dispatch | Uber-Modell für Treatments: Geocoding (Nominatim), PostGIS-Umkreis, zeitboxte Offers, erster Accept gewinnt atomar (`accept_offer` RPC), Live-Status auf Leaflet-Karte. | `/book` |
| Provider-Ansicht | Online-Toggle, eingehende Offers mit Countdown, Status-Führung. | `/provider` |
| Stripe | Manual Capture: autorisieren bei Match, einziehen bei Abschluss, erstatten bei Storno; ohne Key Testmodus. | automatisch |

## 7. RecruitOS — Model-Recruiting (Inbound only)

| Funktion | Ein Satz | Nutzung |
|---|---|---|
| Öffentliche Landing | TFP-Bewerbungsformular ohne Login (Honeypot, Consent, Rate-Limit 5/h/IP). | `/model` — Link in Bio |
| Pipeline | Kanban der Bewerbungen mit Stages. | `/recruit`, `/recruit/bewerbungen` |
| TFP-Vertrag | Druckseite DE/EN pro Model. | `/recruit/[id]/tfp` |
| Grenzen (bewusst) | Kein Scraping, keine Massen-DMs, OnlyFans nie automatisiert, 18+ mit ID-Check, TFP/Model-Release Pflicht. | dokumentiert, nicht verhandelbar |

## 8. TradingOS — Papier-Labor

| Funktion | Ein Satz | Nutzung |
|---|---|---|
| Tages-Picks | Werktags Cron: Picks mit schriftlicher These, Selbstkritik, Verdict bei Auflösung. | `/trading`, Cron 7:45 UTC |
| Equity-Kurve | KI-Portfolio gegen ETF-Benchmark, 60 Tage rollierend. | `/trading` |
| Harte Grenze | Nur Spielgeld — kein Broker, keine Orders, keine Anlageberatung; echte Trades wurden explizit abgelehnt. | nicht verhandelbar |

## 9. Browser-Extension „MomentumOS Companion" (v0.7.4)

| Funktion | Ein Satz | Nutzung |
|---|---|---|
| Profil-/Chat-Erfassung | Liest die sichtbare Seite (Tinder, Bumble, WhatsApp Web, Instagram, TikTok, Telegram Web, Jobportale …) und legt Kontakte/Nachrichten an. | Overlay-Knopf oder `Alt+M` |
| Antwort-Entwürfe | Entwürfe mit Ton-Chips direkt im Overlay, Einfügen ins Eingabefeld — **gesendet wird nie automatisch**. | Overlay |
| Auto-Scan | Erkennt Chatwechsel und synct nach; DOM-Zeitstempel werden als `sent_at` übernommen. | passiv |
| Job-Erfassung | Inserat der offenen Seite in JobOS übernehmen. | Overlay auf Jobportalen |
| Selektoren-Selbsttest | Warnt, wenn eine Plattform ihr DOM geändert hat. | Popup |
| Installation | `chrome://extensions` → Entwicklermodus → „Entpackt laden" → Ordner `extension/`; Token aus `/settings` eintragen. | einmalig |

## 10. Versteckte/technische Oberflächen

- **7 Vercel-Crons** (`vercel.json`, UTC): 6:00 dispatch, 6:30 jobscan, 7:00 digest, 7:45 trading (Mo–Fr), 8:00 moments, 9:00 followups, So 17:00 weekly. Alle Bearer-gesichert, fail-closed ohne `CRON_SECRET`.
- **3 GitHub Actions**: CI (tsc+eslint+vitest+build je Push), DB Backup (täglich 4:43 — rot solange `BACKUP_SECRET` fehlt), Supabase Keepalive (täglich 5:17).
- **Env-gated Features** (aus ohne Key): Vision/Bilder (`OPENAI_API_KEY`, `IMAGE_API_KEY`), Shrine-Event-Publish (`SHRINE_SERVICE_ROLE_KEY`), Stripe live (`STRIPE_SECRET_KEY`), Telegram-Worker (`TELEGRAM_API_ID/HASH/SESSION`), Autopilot-Veto-Fenster (`AUTOPILOT_VETO_MINUTES`), Offer-TTL (`BOOKOS_OFFER_TTL`).
- **CLI**: `npm run types:gen`, `npm run worker`, `npm run worker:daemon[:stop|:status]`, `npm run telegram:login`, `npm test`, `npm run test:e2e` (Login via `E2E_EMAIL`/`E2E_PASSWORD` in `.env.local`).
- **Settings-Schlüssel** (`settings`-Tabelle als Key-Value-Store): u. a. `extension_token`, `calendar_token`, `telegram_bot_token`, `telegram_chat_id`, `telegram_webhook_secret`, `ticket_webhook_secret`, `ai_budget`, `user_style_profile`, `job_cv_profile`, `morning_briefing`, `cron_heartbeat_*`.

---

## 11. Die fünf wichtigsten End-to-End-Workflows

### W1 — Event von null bis Nachbereitung
1. `/moments/events` → „Neues Event", Titel/Datum/Ort/Kapazität/Ziel-Gästezahl setzen.
2. Auf der Event-Seite Zielpublikum-Tags und (optional) öffentlichen Slug setzen → `/e/<slug>` in die Insta-Bio.
3. „Einladen" öffnen: Kandidaten sind nach Gast-Score sortiert; Häkchen setzen (oder Segment laden) → „Welle einladen". Entwürfe landen in `/queue`.
4. `/queue`: jeden Entwurf lesen, `Enter` = freigeben (Versand über den jeweiligen Kanal bzw. Telegram-Worker), `x` = verwerfen.
5. Zusagen laufen über die RSVP-Links ein; Warteliste und Nachrück-Entwürfe passieren automatisch; nach 3 Tagen Stille den Nachfass-Knopf drücken.
6. Am Abend: Event-Seite → Tür-Modus; Gäste antappen oder ihren QR scannen; zweiter Mensch an der Tür bekommt den Türsteher-Link.
7. Danach: `attended`-Gäste bekommen automatisch Gedächtnis-Eintrag + Follow-up; ab 6 h nach dem Event sammelt der RSVP-Link 1-Frage-Feedback; Serien-Karte zeigt die Quote der Wiederkehrer.

### W2 — Neuer Kontakt aus dem Browser bis zur ersten Antwort
1. Extension installieren (`extension/` entpackt laden), Token aus `/settings` eintragen.
2. Profil oder Chat im Browser öffnen → `Alt+M` → „Erfassen": Kontakt+Nachrichten liegen in der App.
3. Der Opener-/Antwort-Entwurf erscheint im Overlay und in `/queue`; Ton per Chip wechseln, „Einfügen" kopiert ihn ins Eingabefeld der Plattform.
4. Selbst auf „Senden" der Plattform drücken — die App sendet nie.
5. Eingehende Antworten beim nächsten Scan; Versprechen („meld mich Montag") werden automatisch zur Wiedervorlage.

### W3 — Morgenroutine in zehn Minuten
1. Telegram-Briefing lesen (7:00 UTC) oder `/` öffnen.
2. `/focus` starten: Karte für Karte entscheiden (erledigt/snooze/öffnen).
3. `/queue` leeren: `j`/`k` bewegen, `Enter` freigeben, `x` verwerfen.
4. Fertig — alles Weitere melden die Signale.

### W4 — Jobsuche im Schlaf
1. Einmalig: `/settings` → CV-Profil + Suchbegriffe pflegen; `/jobs/cv` → CV bauen.
2. Cron 6:30 UTC scannt, dedupliziert, scored; starke Treffer haben morgens fertige Anschreiben.
3. `/jobs`: Karte prüfen → „Bewerben" öffnet die vorbefüllte Mail; Interview-Termin eintragen → erscheint im Kalender-Feed.
4. Nach 14 Tagen Stille kommt das Nachfass-Signal; Funnel-Statistik zeigt, welches Portal liefert.

### W5 — Frage an die eigenen Daten (+ Schreibaktion)
1. `/ask` öffnen, Modul-Filter setzen (spart Tokens) und fragen: „Wen habe ich seit 3 Monaten nicht gesehen?"
2. Antwort streamt; Quellen sind die eigenen Tabellen (nur Lese-Werkzeuge).
3. Folgt ein Vorschlag wie „Wiedervorlage anlegen?", erscheint eine Karte — erst „Ausführen" schreibt in die DB.

---

## 12. Was die App NICHT kann

### Bewusste Lücken (Entscheidungen, nicht Versäumnisse)
- **Kein automatischer Versand, nirgends.** Jede Nachricht ist Entwurf bis zur Einzel-Freigabe. Kern-Designregel.
- **Kein echtes Trading.** Kein Broker, keine Orders, keine Anlageberatung — wurde explizit hart abgelehnt.
- **Kein Scraping / keine Massen-DMs** (RecruitOS ist Inbound-only; Extension liest nur die sichtbar geöffnete Seite).
- **Kein Multi-User.** Ein Account, keine Rollen, kein Onboarding — die RLS-Policies wären für Mehrbenutzer falsch (`to authenticated using (true)`).
- **Keine WhatsApp-Business-API** (Verdict: Zweitnummer nötig, nicht jetzt) und **kein Pretix-Konto** — der generische Ticket-Webhook wartet auf einen Anbieter.
- **Keine E-Mail-Anbindung (IMAP/SMTP)** — Bewerbungen laufen als mailto-Paket, bewusst ohne Mail-Zugriff.
- **Keine Lizenz** — Code öffentlich lesbar, alle Rechte vorbehalten.

### Vergessene/gewachsene Lücken (würde man erwarten, fehlt aber)
- **Kein Passwort-Reset-Flow und kein 2FA** — wer das Passwort verliert, muss über das Supabase-Dashboard ran.
- **Kein Restore-Drill** — das Restore-Skript existiert, wurde aber nie gegen eine leere DB geprobt; aktuell gibt es mangels `BACKUP_SECRET` gar keine Backups.
- ~~Kein Daten-Export je Modul~~ — **seit R32 geschlossen**: `/api/export` + Karte in `/settings`.
- **Keine Zeitzonen-Einstellung** — Europe/Vienna ist an mehreren Stellen fest verdrahtet.
- **Kein Audit-Log** für Schreibaktionen (wer/was/wann bei Ask-Aktionen und Merges).
- **Offline kann nur die Shell** — die PWA cached keine Daten (außer der Tür-Warteschlange).
- **E2E läuft gegen die Dev-DB** — exakte Statuscodes öffentlicher Routen (404 vs 200) sind nur in Produktion prüfbar.
- ~~`middleware.ts` deprecated~~ — **seit R32 migriert** auf `src/proxy.ts` (Codemod, Verhalten identisch).

---

## 13. Rumsfeld-Analyse

### Known Knowns (dokumentiert und sichtbar)
Architektur und Kernloop stehen im `README.md` (Signal-Engine, Module, Cron-Tabelle, Env-Vars, Design-Prinzipien). `BACKUP.md` beschreibt Backup/Restore. `SECURITY-AUDIT.md` (neu) listet die Sicherheitslage. Der Code hat null TODO/FIXME-Marker — was offen ist, steht in Dokumenten, nicht im Code. 43 Migrationen, 43 Tabellen, RLS überall aktiv (Ausnahme: PostGIS-Systemtabelle), 222 Unit-Tests + 16 E2E, CI grün.

### Known Unknowns (offene Fragen, die das Projekt selbst stellt)
1. **`BACKUP_SECRET` ungesetzt** — der tägliche Backup-Workflow ist seit Anlage rot; es existiert kein einziges Backup.
2. **`SHRINE_SERVICE_ROLE_KEY` fehlt in Vercel** — Shrine-Event-Publish ist gebaut, aber tot.
3. **`OPENAI_API_KEY` (Vision/Bilder) gesetzt?** — Foto-Check und Kartenbilder sind env-gated.
4. **Läuft der Telegram-Worker wirklich?** — launchd-Setup existiert; ob Login (`telegram:login`) je durchgeführt wurde, weiß nur der Rechner.
5. **Vercel-Cron-Realität** — 7 Crons konfiguriert; ob der Plan alle täglich feuert, verrät nur das Heartbeat-Signal.
6. **jobscan-Portale** — Selbstheilung eingebaut, aber Portale ändern Markup; die Scraper-Metrik ist die einzige Wahrheit.
7. ~~`middleware` → `proxy`~~ — in R32 migriert.
8. **Restore ungetestet** — siehe oben.

### Unknown Knowns (implizites Wissen — hiermit explizit gemacht)
Diese Konventionen stehen nirgends zentral, stecken aber überall im Code (jetzt auch in `CLAUDE.md`):
1. **Single-User ist eine Sicherheitsannahme**: RLS-Policies heißen `owner_all … to authenticated using (true)` — JEDER eingeloggte Account sähe alles. Es darf nie einen zweiten Account geben.
2. **Server-Actions liefern `{ error }` statt zu werfen**; die UI zeigt die Meldung an. Kein try/catch-Theater in Komponenten.
3. **Admin-Client (`createAdminClient`) nie in Client-Komponenten** — nur Crons, Webhooks, öffentliche Token-Routen.
4. **Öffentliche-Seiten-Muster**: Middleware-Ausnahme + `robots: noindex` + Admin-Client-Lookup + neutrale Fehlermeldung ohne Datenleck + Rate-Limit + (bei Formularen) Honeypot und Consent-Pflicht.
5. **Stil-Regeln sind deterministisch**: `enforceStyle()` (keine Binde-/Gedankenstriche, kein Satzend-Punkt) läuft nach JEDER Textgenerierung; „höflich" ist als Wort verboten.
6. **Zeiten**: DB speichert UTC, alle Nutzer-Vergleiche rechnen über den Wien-Kalendertag (`Intl.DateTimeFormat` mit `Europe/Vienna`).
7. **`database.types.ts` nie anfassen** — `npm run types:gen` oder Supabase-MCP; Enum-Erweiterungen brauchen eine eigene Migration VOR der Nutzung.
8. **`dbLabels.ts` ist ein exhaustives Record** — neuer Enum-Wert ohne Label = Compile-Fehler (gewollt als Erinnerung).
9. **Neue Tabelle? Drei Orte**: Migration + `TABLES` in `src/app/api/backup/route.ts` + `ORDER` in `scripts/restore-backup.mjs`.
10. **`settings` ist der Secret-Store** für rotierbare Tokens (Extension, Telegram, Webhooks, Kalender) — bewusst DB statt Env, damit Rotation ohne Deploy geht.
11. **Crons sind fail-closed** (503 ohne `CRON_SECRET`) und schreiben Heartbeats; neue Crons müssen beides tun.
12. **`react-hooks/purity`**: `Date.now()` nie im Komponenten-Render — Modul-Level-Helfer extrahieren.
13. **Playwright-Artefakte** gehören nach `.pwtmp/` (gitignored) — Screenshots enthalten echte Kontaktdaten, das Repo ist öffentlich. Nie `git add -A` nach Testläufen.
14. **Commits**: Deutsch, konventionelle Präfixe (feat/fix/chore/test/ci), keine KI-Attribution, keine echten Namen.

### Unknown Unknowns (die 5 wahrscheinlichsten blinden Flecken)
1. **Datenverlust-Kaskade**: Kein Backup + Free-Tier-Pause + nie geprobter Restore. Ein versehentliches `truncate`, eine kaputte Migration oder eine Supabase-Projektpause, und alles von 31 Runden ist weg. Wahrscheinlichster Totalschaden.
2. **Stiller Plattform-Drift**: Tinder/WhatsApp/Jobportale ändern ihr DOM → Extension und jobscan liefern leise Müll oder nichts. Selbsttest und Scraper-Metrik fangen das teilweise — aber nur, wenn jemand hinschaut.
3. **Kosten-Blindflug außerhalb der KI**: Der Kosten-Guard deckelt Modellaufrufe, aber nicht Vercel-Bandbreite, Supabase-Storage-Wachstum (Bilder!) oder einen Amok-Cron in Endlosschleife vor dem Guard-Greifen.
4. **DSGVO-Exposition**: Die DB hält Daten Dritter (Chats, Fotos, Geburtstage) ohne Lösch-/Auskunftsprozess; zwei Storage-Buckets sind public; ein Entwicklungs-Screenshot mit personenbezogenen Daten liegt in der öffentlichen Git-Historie. Ein einziges Auskunftsverlangen macht daraus Arbeit, ein Beschwerde-Fall ein Problem.
5. **Auth-Single-Point**: Ein Account, kein 2FA, kein geprobter Recovery-Weg. Passwort-Leak = Vollzugriff auf alles inklusive Schreibaktionen; Passwort-Verlust = Aussperrung bis zum Supabase-Dashboard-Eingriff.
