# Plant Tracker — Design Spec
**Date:** 2026-06-11

## Overview

A Progressive Web App (PWA) for tracking houseplants and garden plants. Users snap a photo to identify a plant via Claude vision, which pre-fills care schedules. The app surfaces contextual AI care tips, supports per-plant chat with Claude, logs all care activity, and sends smart push notifications when plants are due for watering, repotting, or feeding.

No native app. No third-party notification service. All AI via Anthropic API.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | NextAuth v5 (Auth.js) — Google OAuth |
| Database | Turso (LibSQL/SQLite) |
| Image storage | Vercel Blob |
| Hosting | Vercel |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Push notifications | Web Push API (VAPID, no third party) |
| Scheduling | Vercel Cron |

---

## Navigation

Single scrollable plant feed with a floating action button (FAB). Tapping a plant opens its detail page. Tapping "+" opens the identify flow. No bottom tabs — minimal navigation.

---

## Data Model

### `users`
Managed by NextAuth. Fields: id, name, email, image.

### `plants`
| Field | Type | Notes |
|---|---|---|
| id | text (ULID) | PK |
| user_id | text | FK → users |
| common_name | text | |
| scientific_name | text | |
| soil_id | text | FK → soils (nullable) |
| location | text | indoor \| outdoor \| balcony \| greenhouse |
| watering_interval_days | integer | |
| repotting_interval_days | integer | |
| fertilizing_interval_days | integer | |
| last_watered_at | datetime | |
| last_repotted_at | datetime | |
| last_fertilized_at | datetime | |
| next_watering_at | datetime | |
| next_repotting_at | datetime | |
| next_fertilizing_at | datetime | |
| notes | text | |
| created_at | datetime | |

### `plant_photos`
| Field | Type | Notes |
|---|---|---|
| id | text (ULID) | PK |
| plant_id | text | FK → plants |
| blob_url | text | Vercel Blob URL |
| taken_at | datetime | |
| is_primary | boolean | First/identification photo |

### `care_logs`
Simple activity log for quick tap-to-log actions.

| Field | Type | Notes |
|---|---|---|
| id | text (ULID) | PK |
| plant_id | text | FK → plants |
| type | text | water \| repot |
| logged_at | datetime | |
| notes | text | |

Fertilizer events are tracked exclusively in `fertilizer_logs` (richer data — product, dosage, NPK).

### `fertilizers`
Reusable product catalog — enter once, reference from logs.

| Field | Type | Notes |
|---|---|---|
| id | text (ULID) | PK |
| user_id | text | FK → users |
| brand | text | e.g. "Miracle-Gro" |
| product_name | text | |
| type | text | liquid \| granular \| slow-release \| organic \| spike |
| npk_ratio | text | e.g. "10-10-10" |
| notes | text | |

### `fertilizer_logs`
| Field | Type | Notes |
|---|---|---|
| id | text (ULID) | PK |
| plant_id | text | FK → plants |
| fertilizer_id | text | FK → fertilizers (nullable for ad-hoc) |
| fed_at | datetime | |
| dosage | real | |
| dosage_unit | text | ml \| g \| tsp |
| notes | text | |

### `soils`
Reusable soil catalog.

| Field | Type | Notes |
|---|---|---|
| id | text (ULID) | PK |
| user_id | text | FK → users |
| brand | text | |
| type | text | potting mix \| cactus mix \| orchid mix \| custom |
| mix_description | text | e.g. "soil/pumice 50/50" |
| notes | text | |

### `push_subscriptions`
| Field | Type | Notes |
|---|---|---|
| id | text (ULID) | PK |
| user_id | text | FK → users |
| endpoint | text | Web Push endpoint |
| p256dh | text | VAPID key |
| auth | text | VAPID auth secret |
| created_at | datetime | |

---

## App Routes

```
app/
├── (auth)/
│   └── login/                  # NextAuth sign-in page
├── (app)/
│   ├── page.tsx                # Plant feed — scrollable list + FAB
│   ├── plants/
│   │   ├── new/page.tsx        # Camera → identify → confirm flow
│   │   └── [id]/
│   │       ├── page.tsx        # Plant detail (photos, care, streaming tips)
│   │       └── chat/page.tsx   # Per-plant Claude chat
│   └── settings/page.tsx       # Notification time, push permission, account
└── api/
    ├── plants/                 # CRUD — list, create, update, delete
    ├── identify/               # Claude vision → pre-filled plant data (JSON)
    ├── tips/[id]/              # Streaming care tips (Server-Sent Events)
    ├── chat/[id]/              # Streaming per-plant chat
    ├── care-logs/              # Append care event, update plant next_* dates
    ├── photos/                 # Upload photo to Vercel Blob, save to plant_photos
    ├── notifications/
    │   └── subscribe/          # Save/update VAPID push subscription for device
    └── cron/
        └── notify/             # Daily cron: check due plants, Claude adjust, send push
```

---

## Key User Flows

### 1. Add Plant (Identify)
1. Tap FAB on feed
2. Camera opens (or file upload fallback)
3. Photo sent to `/api/identify` — Claude vision returns structured JSON
4. Confirm screen: pre-filled name, species, watering/repotting/fertilizing intervals, soil suggestion, location. All fields editable.
5. On save: photo uploaded to Vercel Blob, plant + plant_photo rows created, next care dates calculated.

### 2. View Plant + Log Care
1. Tap plant on feed
2. Detail page loads: photo timeline (chronological), care schedule, next due dates
3. `/api/tips/[id]` called on load — Claude streams a 2–3 sentence contextual tip
4. Log care button (water / repot) appends to `care_logs`, updates `last_*` and `next_*` on the plant. Fertilizer logging creates a `fertilizer_logs` row and updates `plants.last_fertilized_at` + `plants.next_fertilizing_at` (= `fed_at + fertilizing_interval_days`).
5. Chat button opens `/plants/[id]/chat` — per-plant conversation with Claude

### 3. Daily Notification (Cron)
1. Vercel Cron fires at user's preferred time (set in settings)
2. `/api/cron/notify` queries all plants with `next_watering_at`, `next_repotting_at`, or `next_fertilizing_at` = today
3. For each due plant, Claude receives: species, location, current month, care history — returns adjusted due date (±2 days) and a one-line notification body
4. Web Push (VAPID) sent to all `push_subscriptions` for the user
5. Service worker displays notification; tapping opens the plant detail page

---

## AI Integration

### 1. Plant Identification (`/api/identify`)
- Model: `claude-sonnet-4-6` (vision)
- Input: base64 image
- Output: structured JSON — common_name, scientific_name, watering_interval_days, repotting_interval_days, fertilizing_interval_days, suggested_soil_type, location_preference
- Not streamed

### 2. Streaming Care Tips (`/api/tips/[id]`)
- Model: `claude-sonnet-4-6`
- System prompt context: species, scientific name, soil mix, location, current month, last watered, last repotted, last fertilized, NPK of last fertilizer used
- Output: 2–3 sentence contextual care tip, streamed via Server-Sent Events
- Called once per plant detail page load

### 3. Per-Plant Chat (`/api/chat/[id]`)
- Model: `claude-sonnet-4-6`
- Same context as tips injected as system prompt
- Multi-turn within session; no persistent chat history in v1 (resets on page reload)
- Streamed

### 4. Notification Nudge (`/api/cron/notify`)
- Model: `claude-sonnet-4-6`
- Batch: one call per due plant
- Input: species, location, current month, days since last care
- Output: adjusted_days (integer, ±2), notification_body (string, ≤100 chars)
- Not streamed; must complete within Vercel function timeout

---

## PWA & Push Notifications

- `manifest.json`: name, icons, theme color, `display: standalone`, `start_url: /`
- Service worker registered on app load; handles `push` events to show notifications
- Push subscription (VAPID) requested in settings after user explicitly opts in
- Notification tap deep-links to the relevant plant detail page
- `.gitignore` includes `.superpowers/`

---

## Future Extensions (not in v1)

- **Global AI assistant**: floating chat button on the feed, context = all plants. Same chat component as per-plant, different context scope.
- Pot size tracking for repotting tip precision
- Persistent chat history per plant

---

## Out of Scope (v1)

- Multiple users / sharing
- Offline-first sync (app requires network for AI features; basic plant list readable offline via service worker cache)
- Native app (iOS/Android)
