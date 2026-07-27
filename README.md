# MomentumOS — Personal Operations Platform

[![CI](https://github.com/Drstoneorg/matchos/actions/workflows/ci.yml/badge.svg)](https://github.com/Drstoneorg/matchos/actions/workflows/ci.yml)

A single-user platform that runs the recurring parts of a personal and professional life:
staying in touch with the people who matter, booking artists for events, running a job
search, tracking a paper-trading experiment, and managing dating conversations.

Five modules, one idea: **everything that needs attention becomes a signal, every signal
carries its action, and nothing leaves the app without an explicit approval.**

> Die Oberfläche der App ist auf Deutsch — Code, Doku und Commits ebenfalls teilweise.
> This README is in English; the running application is German.

---

## The core loop

Most personal tools are lists you have to remember to open. This one inverts that: a single
signal engine (`src/lib/signals.ts`) queries all five modules and produces one ranked feed,
which then powers four surfaces — the dashboard, the inbox, a card-by-card focus mode, and a
morning briefing pushed to Telegram.

```
 modules  →  collectSignals()  →  ┬─ dashboard (bento tiles + sparklines)
                                  ├─ /inbox    (grouped, with per-signal actions)
                                  ├─ /focus    (one card at a time, keyboard-driven)
                                  └─ Telegram  (morning briefing + inline buttons)
```

A typical day is: read the briefing, press *start the day*, work through the cards, clear the
approval queue with `j` / `k` / `Enter`. Ten minutes.

---

## Modules

### MomentOS — relationships

Keeping up with friends and family, without holding the calendar in your head.

- **Contact rhythm** — set a cadence per person ("every three weeks"); a connection score and
  a *quiet for too long* signal surface whoever is slipping, ranked by relationship weight
- **Birthdays** with three days of lead time, batch greeting drafts, and a daily reminder that
  updates in place instead of stacking up
- **AI collectible cards** — trading-card-style keepsakes generated per person from a
  whitelist of facts (`src/lib/cardFacts.ts`), rendered over an uploaded template, with a
  send history archive
- **Events & meetups** — invitations per person over their own channels, RSVP tracking, slot
  proposals, ICS export with reminders, post-event notes flowing back into the memory store
- **Guest lists** with promo codes, exportable as CSV for the door

### BookOS — artist booking & on-demand services

Two halves: a booking CRM for DJs and live acts, and an Uber-style dispatch system for
on-demand appointments.

- **Artist CRM** — genres, contacts, fees, gig pipeline (inquiry → confirmed → played)
- **Inquiry generator** with follow-up signals when a request goes stale, plus a lineup
  builder and contract PDF export
- **On-demand dispatch** (`/book`) — geocoding via OpenStreetMap, PostGIS proximity search
  (`nearby_providers`), time-boxed offers where the first accept wins atomically
  (`accept_offer` RPC), live status over Supabase Realtime with a Leaflet map
- **Payments** via Stripe with manual capture (authorize on match, capture on completion,
  refund on cancellation); without a Stripe key everything runs in test mode

### JobOS — job search

The search runs overnight; you only act on matches.

- **Nightly scan** across Vienna and Berlin with deduplication by URL and company/title
  fingerprint, plus a scraper health metric
- **Match scoring** against a stored CV, with cover letters drafted automatically for strong
  hits and a one-click application package that opens a prefilled email
- **CV builder** — three layouts, five accent colours, switchable live
- **Follow-up signals** after 14 days of silence, **interview preparation** generated from the
  posting, and funnel statistics per source

### TradingOS — paper trading lab

A measurement experiment, not a broker.

- Daily picks with a written thesis, a self-critique pass, and a verdict when the thesis
  resolves
- Equity curve of the AI portfolio against a benchmark, 60 days rolling
- **Play money only.** There is no broker integration, no order routing, and nothing here is
  financial advice

### MatchOS — new acquaintances

Help with the early stage of getting to know someone: remembering what was said, and not
leaving people hanging. The oldest module, and now the smallest one.

- Contact inbox with a per-person memory store and conversation summaries, so context survives
  a two-week gap
- Reply drafts in several tones, with a learned per-person tone offset
- Promise detection: an incoming *"I'll get back to you next week"* becomes a dated reminder
  (plain regex, no model call)
- Reminders for conversations that went quiet, and automatic archiving after 90 days
- Meetings with ICS export

---

## Platform layer

| Capability | Detail |
|---|---|
| Signal engine | One source (`signals.ts`) feeding dashboard, inbox, focus mode, briefing; snoozeable per signal |
| Command palette | `⌘K` — fuzzy search over pages, contacts, jobs, artists, events |
| Approval queue | Every AI draft waits here; `j`/`k` to move, `Enter` to approve, `x` to discard |
| Telegram bot | Morning briefing and weekly digest with inline buttons (done / snooze / approve), webhook secured by a secret token bound to one chat ID |
| PWA | Installable, offline page, web push |
| Browser helper | Optional extension that reads a visible profile or chat and files it into the app |
| Cost control | Every model call logged with tokens and estimated cost; a monthly budget blocks further calls when reached |
| Health | Cron heartbeats with a watchdog on the dashboard, daily database backups to GitHub Actions artifacts |
| Tests | 121 unit tests plus a Playwright smoke suite; typecheck, tests and build on every push |

### Automation schedule

All times UTC. Deployed on Vercel Cron; the schedule fits within Hobby-plan limits.

| Time | Job | Does |
|---|---|---|
| 06:00 | `dispatch` | Drafts replies for open conversations and openers |
| 06:30 | `jobscan` | Job search, scoring, cover letters for top matches |
| 07:00 | `digest` | Generates and sends the morning briefing |
| 07:45 | `trading` | Paper picks and the equity snapshot (weekdays) |
| 08:00 | `moments` | Birthday and contact-rhythm reminders |
| 09:00 | `followups` | Due follow-ups, ghosting radar, auto-archive |
| Sun 17:00 | `weekly` | Weekly digest with response rates and funnel numbers |

---

## Design principles

**Nothing sends itself.** Every generated message is a draft until approved individually — in
the queue, in focus mode, or through a Telegram button. Batch mode makes approving faster; it
never approves everything at once. This is deliberate: the value of a drafted message is that
you read it before it goes.

**Fail closed.** Cron endpoints refuse to run without their secret rather than running
unprotected. Row-level security policies are pinned to the owning account.

**Cheap where cheap works.** Promise detection, match scoring, deduplication and the fallback
briefing are plain deterministic code. Models are used where language actually matters.

**One feed, not five inboxes.** Modules contribute signals; they don't each demand their own
routine.

---

## Stack

- **Next.js 16** (App Router, React 19, TypeScript) on Vercel
- **Tailwind v4** with a module colour registry (`src/lib/modules.ts`) driving nav, tiles and chips
- **Supabase** — Postgres with PostGIS, Auth, Storage, Realtime; RLS on every table
- **DeepSeek** for text generation, **OpenAI** for vision and image generation
- **gramjs** worker for Telegram (runs locally, not on Vercel)
- **Vitest** + **Playwright**

### Architecture

```
src/lib/signals.ts        signal engine — the spine of the app
src/lib/modules.ts        module registry (labels, colours, routes)
src/lib/actions.ts        server actions (return { error }, never throw)
src/lib/ai/               model clients, prompts, usage accounting
src/app/api/cron/*        scheduled jobs, Bearer-secured, fail-closed
src/app/api/extension/*   browser helper API, token-authenticated, rate-limited
worker/telegram.ts        sends approved drafts; never sends anything else
```

## Setup

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests
npm run test:e2e # Playwright smoke suite
```

Environment variables (`.env.local` locally, project settings in Vercel):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron jobs and extension API (no browser session) |
| `DEEPSEEK_API_KEY` | Text generation — everything else works without it |
| `OPENAI_API_KEY` | Vision checks and image generation |
| `CRON_SECRET` | Required; cron routes refuse to run without it |
| `BACKUP_SECRET` | Guards the backup export endpoint |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push |
| `CONTACT_EMAIL` | Contact address for VAPID and the Nominatim user agent |
| `NEXT_PUBLIC_SITE_URL` | Public base URL — used for Telegram buttons and webhook addresses. Falls back to the current production URL |
| `STRIPE_SECRET_KEY` | Optional — without it, bookings run in test mode |
| `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` / `TELEGRAM_SESSION` | Local worker only |

## Scope and disclaimers

This is a personal, single-user system, published for reference rather than as a product.
There is no multi-tenancy, no onboarding, and no support.

- **Your data stays yours.** Everything the app stores — contacts, notes, message history —
  lives in your own Supabase project, readable only by your account. Nothing is shared, sold,
  or sent anywhere except the model provider you configure.
- **The browser helper is a reading aid.** It works on pages you already have open in your own
  logged-in session and files what it finds into your own notes. It never sends messages. Check
  the terms of any service you use it on, and keep it to a human pace.
- **TradingOS is a simulation.** No broker, no real orders, no investment advice.
- **No licence is granted.** The source is public to read; all rights reserved.
