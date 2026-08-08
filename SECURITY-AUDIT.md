# Sicherheitsaudit — MomentumOS

Datum: 2026-08-08. Umfang: Code, Git-Historie, Abhängigkeiten, Supabase (RLS, Advisors,
Storage, Auth-Konfiguration), API-Routen-Auth, Injection/XSS/SSRF/CORS, Uploads, CI/Backups.
Methodik: statischer Scan + `npm audit` + Supabase-Security-Advisors + manuelle Review aller
52 API-Routen und 7 Server-Action-Dateien.

**Ergebnisstand: 1 Fund behoben, 3 offene Funde brauchen Nutzer-Aktion (Secrets/Infrastruktur/
History-Rewrite — bewusst nicht automatisiert). Kein Fund erlaubt anonymen Zugriff auf
personenbezogene Daten über die App selbst.**

---

## Behoben in dieser Session

### ✅ H1 (HOCH) — 7 bekannte CVEs in Abhängigkeiten
- **Fund:** `npm audit` meldete 7 High-Severity-Advisories: in Next 16.2.10 gebündeltes
  PostCSS (XSS über unescaptes `</style>`, GHSA-qx2v-qp2m-jg93, plus Source-Map-Datei-Lecks)
  und sharp/libvips (CVE-2026-33327/-33328/-35590/-35591), dazu `brace-expansion`,
  `ip-address` und `js-yaml` (DoS/SSRF-Klassifikationsfehler) in Unterabhängigkeiten.
- **Fix:** Upgrade auf `next@16.3.0` + `eslint-config-next@16.3.0`, danach `npm audit fix`
  für die semver-kompatiblen Reste. Ergebnis: **0 bekannte Verwundbarkeiten.**
- **Verifikation:** Typecheck, ESLint, 222 Unit-Tests, Produktions-Build und 16/16
  Playwright-E2E grün. Commit `17e1b2f`.
- Nebenbefund: Next 16.3 markiert die `middleware`-Datei-Konvention als deprecated
  (Build-Warnung). Kein Sicherheitsproblem; Migration auf `proxy` steht in `ROADMAP-FABLE.md`.

---

## Offen — braucht den Menschen (exakte Schrittanleitungen)

### ⛔ K1 (KRITISCH) — Es existiert kein einziges Backup
- **Fund:** Der tägliche Workflow „DB Backup" schlägt seit Anlage fehl (zuletzt geprüfte
  Läufe: alle rot), weil das GitHub-Secret `BACKUP_SECRET` nie gesetzt wurde. `/api/backup`
  ist korrekt fail-closed — deshalb gibt es aber auch **null Backups** einer Datenbank mit
  echten personenbezogenen Daten. Zusammen mit dem nie geprobten Restore ist das das größte
  Einzelrisiko des Projekts (Totalverlust bei kaputter Migration, versehentlichem Truncate
  oder Supabase-Problem).
- **Warum nicht automatisiert:** Secret-Erzeugung/-Verteilung gehört nicht in eine Session.
- **Anleitung (5 Minuten):**
  1. Secret erzeugen: `openssl rand -hex 32`
  2. Vercel → Projekt `momentumos-hq` → Settings → Environment Variables →
     `BACKUP_SECRET` = Wert → alle Environments → Redeploy.
  3. GitHub → Repo → Settings → Secrets and variables → Actions →
     „New repository secret" → Name `BACKUP_SECRET`, gleicher Wert.
  4. GitHub → Actions → „DB Backup" → „Run workflow" → Lauf muss grün werden und ein
     Artifact `momentumos-backup-…` erzeugen.
  5. Einmal die Restore-Probe aus `BACKUP.md` durchspielen (mindestens: Artifact
     herunterladen, entschlüsseln, `table_count`/Zeilen prüfen).

### ⚠️ H2 (HOCH) — Personenbezogene Datei in der öffentlichen Git-Historie
- **Fund:** Ein früherer Entwicklungs-Screenshot mit personenbezogenen Daten wurde in
  Commit-Historie aufgenommen und später nur aus dem Arbeitsverzeichnis entfernt
  (`f206aed`); über die Historie des öffentlichen Repos ist die Datei weiter abrufbar.
- **Warum nicht automatisiert:** Der Fix erfordert History-Rewrite + Force-Push; beides ist
  für automatisierte Sessions gesperrt und gehört in Nutzerhand.
- **Anleitung:**
  1. `pip install git-filter-repo` (oder `brew install git-filter-repo`)
  2. Frischen Klon anlegen (filter-repo verweigert sonst): `git clone git@github.com:Drstoneorg/MomentumOS.git mos-clean && cd mos-clean`
  3. `git filter-repo --invert-paths --path ask-prod.png`
  4. Remote neu setzen (filter-repo entfernt ihn): `git remote add origin git@github.com:Drstoneorg/MomentumOS.git`
  5. `git push --force --all origin` und `git push --force --tags origin`
  6. GitHub-Cache: Repo → Settings → ggf. Support-Anfrage „cached views purge" (GitHub hält
     gelöschte Objekte sonst noch eine Weile über die API erreichbar).
  7. Lokale Arbeitskopie danach neu klonen (alte Klone tragen die alte Historie).

### ⚠️ H3 (HOCH, Datenschutz) — Öffentliche Storage-Buckets mit Fotos Dritter
- **Fund:** Die Buckets `avatars` und `moment-images` sind `public: true`. Objekt-URLs sind
  zwar nicht auflistbar und enthalten UUID-Pfade, aber jede einmal geteilte/geleakte URL ist
  dauerhaft für jeden abrufbar — es liegen Fotos realer Dritter darin.
- **Warum nicht automatisiert:** Der Wechsel auf private Buckets + signierte URLs ändert
  Verhalten an mehreren Stellen (Avatar-Anzeige, Karten-Versand, Telegram-Bilder) und
  braucht einen Code-Umbau — fertig vorbereitet als Konzept 12 in `ROADMAP-FABLE.md`.
- **Bis dahin:** keine Objekt-URLs weitergeben; Uploads sparsam halten.

---

## Offen — MITTEL

### M1 — Leaked-Password-Protection deaktiviert (Supabase Auth)
Supabase kann Passwörter gegen HaveIBeenPwned prüfen; das ist aus. Ein-Klick-Fix:
Supabase-Dashboard → Authentication → Providers/Passwords → „Leaked password protection"
aktivieren. Bei einem Single-User-System mit Vollzugriff aufs Leben des Nutzers lohnt
zusätzlich ein langes, einmaliges Passwort (Manager) — 2FA gibt es aktuell nicht (siehe
Roadmap 13).

### M2 — `spatial_ref_sys` ohne RLS (PostGIS-Systemtabelle)
Der Supabase-Advisor meldet: die PostGIS-Referenztabelle `public.spatial_ref_sys` (8500
SRID-Zeilen, keine personenbezogenen Daten) ist ohne RLS über PostgREST erreichbar —
schlimmstenfalls könnte die `anon`-Rolle Referenzdaten verändern (Geodaten-Poisoning für
die BookOS-Umkreissuche). RLS einfach einzuschalten kann PostGIS-Abfragen brechen und
scheitert oft an den Besitzrechten der Extension; der saubere Weg ist ein Schreib-Revoke.
**Empfohlener Fix (im SQL-Editor als `postgres` ausführen, nicht automatisch angewendet):**
```sql
revoke insert, update, delete on table public.spatial_ref_sys from anon, authenticated;
```
Referenz: https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public

---

## Offen — NIEDRIG

### N1 — PostGIS-Funktion `st_estimatedextent` für `anon` ausführbar
SECURITY-DEFINER-Funktion, über `/rest/v1/rpc/` aufrufbar; verrät höchstens grobe
Ausdehnungs-Schätzungen von Geometrie-Spalten. Optionaler Fix im SQL-Editor:
```sql
revoke execute on function public.st_estimatedextent(text, text) from anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text) from anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text, boolean) from anon, authenticated;
```

### N2 — PostGIS-Extension im `public`-Schema
Advisor-WARN. Umzug in ein eigenes Schema ist bei bestehenden Geometrie-Spalten aufwendig
und riskant; bewusst belassen und dokumentiert.

---

## Geprüft und in Ordnung (Akzeptierte Architektur-Entscheidungen)

| Bereich | Befund |
|---|---|
| **API-Auth, alle 52 Routen** | Jede Route authentifiziert: Browser-Session (`getUser()`), Cron-Bearer (fail-closed 503 ohne `CRON_SECRET`), Extension-Bearer gegen `settings.extension_token` (min. 20 Zeichen) mit Stunden-Rate-Limits, Webhook-Secrets aus der DB (Telegram `x-telegram-bot-api-secret-token`, Ticket `X-Webhook-Key` — beide fail-closed), oder Token-in-URL für bewusst öffentliche Flächen (RSVP/ICS/Tür: 32-Hex-Token, Format-geprüft, rate-limitiert, neutrale Fehlermeldungen ohne Datenleck). Öffentliche Formulare (`/api/apply`, `/api/event-lead`) haben Honeypot + Consent-Pflicht + IP- und Gesamt-Rate-Limits. `/api/errors` 20/h/IP, `/api/keepalive` gibt nur einen Zähler zurück. |
| **Server-Actions** | Alle 7 Action-Dateien prüfen `getUser()` am Eintritt; Admin-Client kommt in Actions nur nach bestandener Auth zum Einsatz. |
| **RLS** | Alle 43 App-Tabellen: RLS aktiv, Policies `owner_all … to authenticated`. `rate_limits` hat absichtlich RLS ohne Policy (nur Service-Role schreibt — anon/authenticated komplett ausgesperrt). Wichtig: das Modell ist nur sicher, solange es **genau einen** Account gibt (Single-User-Annahme, siehe `CLAUDE.md`). |
| **Injection** | Kein Roh-SQL im App-Code (nur Query-Builder). Die drei Stellen, die Nutzereingaben in PostgREST-`or()`-Filter interpolieren (`/search`, `/api/palette`, Ask-Werkzeug „bewerbungen"), säubern die Eingabe bereits um `[,()%]`. |
| **XSS** | Kein einziges `dangerouslySetInnerHTML`; React-Escaping durchgängig; KI-Ausgaben werden als Text gerendert. |
| **SSRF** | Link-Erfassung (`src/lib/urlCapture.ts`) erlaubt nur öffentliche http(s)-Ziele: localhost, `.local`, private IPv4-Bereiche und punktlose Hostnamen sind geblockt. Restrisiko DNS-Rebinding akzeptiert (authentifizierter Single-User, Vercel-Umgebung ohne internes Netz). |
| **CORS** | `Access-Control-Allow-Origin: *` nur auf Extension-Routen — dort korrekt: Auth ist ein Bearer-Token (kein Cookie), Browser-Ambient-Authority existiert nicht; die Extension braucht Cross-Origin-Zugriff von den Plattform-Seiten aus. |
| **Secrets** | Keine Secrets im Code oder in der Datei-Historie (Muster-Scan + Datei-Scan über alle Commits; `.env*` gitignored, CI nutzt Dummy-Werte). Rotierbare Tokens liegen bewusst in der `settings`-Tabelle (RLS-geschützt; Rotation ohne Deploy; im verschlüsselten Backup enthalten). |
| **Uploads** | Bild-Uploads laufen durch `imageResize` (Größenkappung) bzw. als Data-URL an Vision mit Kosten-Guard + Rate-Limit; Storage-Pfade sind UUID-basiert. (Bucket-Sichtbarkeit: siehe H3.) |
| **Öffentliche Seiten** | `/model`, `/einladung/[token]`, `/e/[slug]`, `/tuer/[token]`, `/login` — alle mit `robots: noindex` (außer Login), neutralen Nicht-gefunden-Zuständen und ohne Daten im Fehlerfall; in Produktion smoke-getestet. |
| **Abhängigkeits-Hygiene** | `npm audit`: 0 Findings (nach H1-Fix). Dependabot/Secret-Scanning-Empfehlung: siehe manuelle Aufgaben in `ROADMAP-FABLE.md`. |

## Bekannte Risiko-Akzeptanzen (bewusst, dokumentiert)

- **Extension vs. Plattform-ToS**: Das Mitlesen geöffneter Seiten kann gegen Nutzungsbedingungen
  der Plattformen verstoßen (Konto-Risiko, kein Sicherheitsrisiko der App). Menschliches Tempo,
  kein Auto-Versand — Risiko liegt beim Nutzer.
- **Race im Rate-Limiter**: Zählung nicht atomar (Read-then-Write); bei einem Single-User-System
  verschmerzbar, Fix als Roadmap-Konzept 19 notiert.
- **Zweites Supabase-Projekt (Shrine)**: separate RLS-Lage, in R27 abgedichtet; Schlüssel
  (`SHRINE_SERVICE_ROLE_KEY`) fehlt in Vercel, Feature dadurch inaktiv — kein Risiko, nur tot.
