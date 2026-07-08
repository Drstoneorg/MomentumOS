# MatchOS Roadmap — Leitfaden

Stand: 2026-07-08. Drei Phasen. Reihenfolge fix: Phase 1 → 2 → 3 (2 ist technische Voraussetzung für 3).

**Wording-Regel:** Die BookOS-Dienstleistung heißt überall (UI, DB, Code, Doku) **Treatment**. Buchbare Wellness-Behandlung, transparent als solche geführt.

---

## Phase 1 — Moments wird CRM

Ziel: Kontakte so leicht pflegen wie in einem vollwertigen CRM.

- [x] **1.1 Navigation-Dropdown**: Hauptnav wird Produkt-Switcher — MatchOS (Dating) | Moments | BookOS. Intuitives Dropdown, aktiver Bereich sichtbar.
- [x] **1.2 Schnellerfassung**: globaler „+ Kontakt"-Button (überall erreichbar). Ein Formular, alle Felder optional. Freitext-Zeile („Lisa, 27, Wien, Geburtstag 3.5., Instagram @lisa") → DeepSeek parst in strukturierte Felder (nutzt bestehenden Smart-Import `/api/import/profile`).
- [x] **1.3 Inline-Editing** Kontaktseite: Klick auf Feld = direkt editieren, kein Formular-Umweg.
- [x] **1.4 vCard/CSV-Import**: Datei-Upload (Handy-Export), Vorschau, Duplikat-Erkennung über Name + Kanal-Handle.
- [x] **1.5 CRM-Tabelle** `/contacts`: sortierbare Spalten (Name, Geburtstag, letzter Kontakt, Verbindungs-Score, Tags, Stage), Volltextsuche, Bulk-Tagging.
- [x] **1.6 Aktivitäts-Timeline** pro Kontakt: Nachrichten, Meetups, Check-ins, Notizen, Events chronologisch in einer Ansicht.

## Phase 2 — PWA-Fundament

Ziel: installierbare App, Push, Realtime — Basis für BookOS.

- [x] **2.1 PWA**: `manifest.json`, Icons, Service Worker, installierbar auf Homescreen, Offline-Shell.
- [x] **2.2 Web Push** (VAPID): Benachrichtigungen für Geburtstage, Queue-Freigaben, später Treatment-Buchungsstatus. Subscription-Verwaltung in Settings.
- [x] **2.3 Supabase Realtime**: Channels aktivieren, Client-Hooks — Live-Updates für Queue und BookOS-Dispatch.

## Phase 3 — BookOS (On-Demand-Treatments, Uber-Modell)

Ziel: Treatment in Echtzeit buchen — Anfrage, Live-Dispatch an Anbieter, Statusverfolgung auf Karte, Bezahlung, Bewertung.

- [x] **3.1 Schema**: `providers` (Profil, Skills, Radius, Verfügbarkeit), `bookings` (Status-Maschine: requested → accepted → en_route → arrived → in_progress → completed → rated; cancelled), `booking_offers` (Dispatch), `reviews`, `provider_locations` (Live-Position).
- [x] **3.2 Geolocation**: PostGIS-Extension, Umkreissuche („verfügbare Anbieter in X km"), Adress-Autocomplete (Nominatim).
- [x] **3.3 Realtime-Dispatch**: Buchung anlegen → verfügbare Anbieter im Radius erhalten Offer → erster Accept gewinnt → Kunde sieht Live-Status.
- [x] **3.4 Karte**: Leaflet + OpenStreetMap, Anbieter-Position live, ETA (Haversine, später OSRM).
- [x] **3.5 Provider-Ansicht** `/provider`: online/offline-Toggle, eingehende Offers mit Countdown, Buchungs-Statusführung, Navigations-Link.
- [x] **3.6 Payments**: Stripe — Payment Intent bei Buchung, Capture bei completed, Connect für Anbieter-Auszahlung. Testmodus bis Live-Keys da.
- [x] **3.7 Preislogik**: Basispreis + Dauer + Anfahrt, Stornoregeln (Frist, Gebühr).
- [x] **3.8 Ratings** beidseitig (Kunde ↔ Anbieter), fließen in Dispatch-Ranking.

### Offene Realität Phase 3 (nicht wegbaubar)
Provider-Onboarding, Gewerbe/Rechtliches, Stripe-KYC, echte Anbieter. App kann fertig sein, Marktplatz braucht Menschen.

---

## Grenzen (gelten weiter)
- Kein Auto-Swiper, kein Autoversand an echte Menschen ohne Freigabe/Veto.
- BookOS führt Treatments transparent als Wellness-Dienstleistung — keine Verschleierung des Angebots.
