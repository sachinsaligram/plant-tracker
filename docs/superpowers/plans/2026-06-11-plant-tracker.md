# Plant Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 14 PWA that lets users photograph, identify, and track houseplants with Claude-powered care tips, per-plant chat, and VAPID push notifications.

**Architecture:** App Router Next.js with server components for data fetching, route handlers for all API endpoints, and client components only where interactivity is needed (camera, streaming, push). All AI via Anthropic SDK; database via Turso LibSQL; no third-party notification service. Auth via NextAuth v5 Google OAuth.

**Tech Stack:** Next.js 14 (App Router), NextAuth v5, Turso (LibSQL/SQLite), Vercel Blob, Anthropic Claude API (`claude-sonnet-4-6`), Web Push (VAPID, `web-push`), Vercel Cron, Tailwind CSS, Jest, React Testing Library

---

## File Map

| Path | Responsibility |
|---|---|
| `lib/db.ts` | Turso client singleton |
| `lib/schema.sql` | All CREATE TABLE statements |
| `lib/auth.ts` | NextAuth config, Google provider, user upsert |
| `lib/anthropic.ts` | Anthropic SDK client singleton |
| `lib/blob.ts` | Vercel Blob upload helper |
| `lib/push.ts` | VAPID init + `sendPush` helper |
| `lib/ulid.ts` | ULID generator wrapper |
| `lib/care-dates.ts` | `nextCareDate(lastAt, intervalDays)` |
| `middleware.ts` | Protect `/(app)` routes; redirect to `/login` |
| `types/next-auth.d.ts` | Extend Session type with `user.id` |
| `scripts/migrate.ts` | One-time schema migration script |
| `app/layout.tsx` | Root layout: font, metadata, manifest link, SW registration |
| `app/(auth)/login/page.tsx` | Google sign-in page |
| `app/(app)/layout.tsx` | Auth guard for app shell |
| `app/(app)/page.tsx` | Plant feed: sorted list + FAB + settings link |
| `app/(app)/plants/new/page.tsx` | Wraps `IdentifyFlow` client component |
| `app/(app)/plants/[id]/page.tsx` | Plant detail: photos, care dates, tips, care buttons |
| `app/(app)/plants/[id]/chat/page.tsx` | Per-plant chat page |
| `app/(app)/settings/page.tsx` | Push opt-in, sign-out |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth handlers |
| `app/api/plants/route.ts` | GET (list), POST (create) |
| `app/api/plants/[id]/route.ts` | GET, PATCH, DELETE |
| `app/api/identify/route.ts` | POST: Claude vision → structured JSON |
| `app/api/tips/[id]/route.ts` | GET: streaming SSE care tips |
| `app/api/chat/[id]/route.ts` | POST: streaming per-plant chat |
| `app/api/care-logs/route.ts` | POST: append care event + update next dates |
| `app/api/photos/route.ts` | POST: upload to Vercel Blob + save plant_photo row |
| `app/api/notifications/subscribe/route.ts` | POST: upsert VAPID subscription |
| `app/api/cron/notify/route.ts` | GET: daily cron — due plants, Claude nudge, push |
| `components/plant-card.tsx` | Feed card (name, photo, next water date) |
| `components/fab.tsx` | Floating action button |
| `components/care-buttons.tsx` | Water / Repot / Fertilize quick-log buttons |
| `components/tips-stream.tsx` | SSE reader + streaming tips display |
| `components/chat-interface.tsx` | Per-plant streaming chat UI |
| `components/identify-flow.tsx` | Camera → identify → confirm wizard |
| `components/photo-timeline.tsx` | Horizontal photo strip |
| `components/notification-toggle.tsx` | Push permission opt-in UI |
| `public/manifest.json` | PWA manifest |
| `public/sw.js` | Service worker: push handler + offline cache |
| `vercel.json` | Vercel Cron schedule |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `jest.config.ts`, `jest.setup.ts`, `.env.local.example`, `.gitignore`

- [ ] **Step 1: Bootstrap Next.js app**

```bash
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

Expected: project files created, `npm run dev` starts on port 3000.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install next-auth@beta @auth/core @libsql/client @vercel/blob @anthropic-ai/sdk web-push ulid
npm install -D @types/web-push jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom ts-jest tsx
```

- [ ] **Step 3: Configure Jest**

Create `jest.config.ts`:
```ts
import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
}

export default config
```

Create `jest.setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Create `.env.local.example`**

```env
# Auth
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# Database
TURSO_URL=
TURSO_AUTH_TOKEN=

# Vercel Blob
BLOB_READ_WRITE_TOKEN=

# Anthropic
ANTHROPIC_API_KEY=

# Web Push (VAPID) — generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=

# Cron protection
CRON_SECRET=
```

- [ ] **Step 5: Add test scripts to package.json**

In `package.json`, ensure `scripts` includes:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: bootstrap Next.js 14 project with all dependencies"
```

---

## Task 2: Database Schema + Helpers

**Files:**
- Create: `lib/schema.sql`, `lib/db.ts`, `lib/ulid.ts`, `lib/care-dates.ts`, `scripts/migrate.ts`
- Test: `lib/__tests__/care-dates.test.ts`

- [ ] **Step 1: Write schema**

Create `lib/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  image TEXT
);

CREATE TABLE IF NOT EXISTS soils (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  brand TEXT,
  type TEXT NOT NULL CHECK(type IN ('potting mix','cactus mix','orchid mix','custom')),
  mix_description TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS plants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  common_name TEXT NOT NULL,
  scientific_name TEXT,
  soil_id TEXT REFERENCES soils(id),
  location TEXT NOT NULL CHECK(location IN ('indoor','outdoor','balcony','greenhouse')),
  watering_interval_days INTEGER NOT NULL,
  repotting_interval_days INTEGER NOT NULL,
  fertilizing_interval_days INTEGER NOT NULL,
  last_watered_at TEXT,
  last_repotted_at TEXT,
  last_fertilized_at TEXT,
  next_watering_at TEXT,
  next_repotting_at TEXT,
  next_fertilizing_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plant_photos (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  blob_url TEXT NOT NULL,
  taken_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_primary INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS care_logs (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('water','repot')),
  logged_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS fertilizers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  brand TEXT,
  product_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('liquid','granular','slow-release','organic','spike')),
  npk_ratio TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS fertilizer_logs (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  fertilizer_id TEXT REFERENCES fertilizers(id),
  fed_at TEXT NOT NULL DEFAULT (datetime('now')),
  dosage REAL,
  dosage_unit TEXT CHECK(dosage_unit IN ('ml','g','tsp')),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: Create ULID helper**

Create `lib/ulid.ts`:
```ts
import { ulid as generate } from 'ulid'
export const ulid = () => generate()
```

- [ ] **Step 3: Write failing test for care-dates**

Create `lib/__tests__/care-dates.test.ts`:
```ts
import { nextCareDate } from '@/lib/care-dates'

describe('nextCareDate', () => {
  it('adds interval days to the base date', () => {
    const result = nextCareDate('2026-06-01T00:00:00.000Z', 7)
    expect(result).toBe('2026-06-08T00:00:00.000Z')
  })

  it('returns interval days from now when base is null', () => {
    const now = new Date('2026-06-11T00:00:00.000Z')
    const result = nextCareDate(null, 14, now)
    expect(result).toBe('2026-06-25T00:00:00.000Z')
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npx jest lib/__tests__/care-dates.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/care-dates'`

- [ ] **Step 5: Implement care-dates helper**

Create `lib/care-dates.ts`:
```ts
export function nextCareDate(
  lastAt: string | null,
  intervalDays: number,
  now: Date = new Date()
): string {
  const base = lastAt ? new Date(lastAt) : now
  const next = new Date(base)
  next.setDate(next.getDate() + intervalDays)
  return next.toISOString()
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx jest lib/__tests__/care-dates.test.ts
```

Expected: PASS

- [ ] **Step 7: Create Turso client**

Create `lib/db.ts`:
```ts
import { createClient } from '@libsql/client'

let _client: ReturnType<typeof createClient> | null = null

export function getDb() {
  if (!_client) {
    _client = createClient({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  return _client
}
```

- [ ] **Step 8: Create migration script**

Create `scripts/migrate.ts`:
```ts
import { readFileSync } from 'fs'
import { getDb } from '../lib/db'

const sql = readFileSync('./lib/schema.sql', 'utf8')
const statements = sql.split(';').map(s => s.trim()).filter(Boolean)

const db = getDb()
for (const stmt of statements) {
  await db.execute(stmt)
}
console.log('Migration complete')
```

Run the migration (requires real Turso credentials in `.env.local`):
```bash
npx tsx scripts/migrate.ts
```

Expected: "Migration complete" with all tables created in Turso.

- [ ] **Step 9: Commit**

```bash
git add lib/ scripts/ lib/__tests__/
git commit -m "feat: database schema, Turso client, care-dates helper"
```

---

## Task 3: Auth

**Files:**
- Create: `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `middleware.ts`, `middleware.test.ts`, `app/(auth)/login/page.tsx`, `types/next-auth.d.ts`

- [ ] **Step 1: Write failing test for middleware config**

Create `middleware.test.ts`:
```ts
import { config } from './middleware'

describe('middleware config', () => {
  it('protects app routes', () => {
    expect(config.matcher).toContain('/(app)/:path*')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest middleware.test.ts
```

Expected: FAIL — `Cannot find module './middleware'`

- [ ] **Step 3: Create NextAuth config**

Create `lib/auth.ts`:
```ts
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { getDb } from './db'
import { ulid } from './ulid'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const db = getDb()
      await db.execute({
        sql: `INSERT INTO users (id, name, email, image) VALUES (?, ?, ?, ?)
              ON CONFLICT(email) DO UPDATE SET name=excluded.name, image=excluded.image`,
        args: [ulid(), user.name ?? '', user.email!, user.image ?? null],
      })
      return true
    },
    async session({ session }) {
      const db = getDb()
      const result = await db.execute({
        sql: 'SELECT id FROM users WHERE email = ?',
        args: [session.user.email!],
      })
      session.user.id = result.rows[0]?.id as string
      return session
    },
  },
})
```

- [ ] **Step 4: Extend NextAuth session type**

Create `types/next-auth.d.ts`:
```ts
import 'next-auth'
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}
```

- [ ] **Step 5: Create NextAuth route handler**

Create `app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 6: Create middleware**

Create `middleware.ts`:
```ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
})

export const config = {
  matcher: ['/(app)/:path*'],
}
```

- [ ] **Step 7: Run middleware test**

```bash
npx jest middleware.test.ts
```

Expected: PASS

- [ ] **Step 8: Create login page**

Create `app/(auth)/login/page.tsx`:
```tsx
import { signIn } from '@/lib/auth'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-green-50">
      <form
        action={async () => {
          'use server'
          await signIn('google', { redirectTo: '/' })
        }}
      >
        <button
          type="submit"
          className="rounded-lg bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-700"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 9: Commit**

```bash
git add lib/auth.ts types/ app/api/auth/ middleware.ts middleware.test.ts app/\(auth\)/
git commit -m "feat: NextAuth v5 Google OAuth, session type extension, route protection"
```

---

## Task 4: Plant CRUD API

**Files:**
- Create: `app/api/plants/route.ts`, `app/api/plants/[id]/route.ts`
- Test: `app/api/plants/__tests__/route.test.ts`, `app/api/plants/__tests__/id-route.test.ts`

- [ ] **Step 1: Write failing tests for list + create**

Create `app/api/plants/__tests__/route.test.ts`:
```ts
import { GET, POST } from '../route'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1', email: 'a@b.com' } }),
}))

const mockExecute = jest.fn()
jest.mock('@/lib/db', () => ({ getDb: jest.fn().mockReturnValue({ execute: mockExecute }) }))

describe('GET /api/plants', () => {
  it('returns plants for authenticated user', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 'p1', common_name: 'Monstera', user_id: 'user-1', primary_photo: null }],
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].common_name).toBe('Monstera')
  })
})

describe('POST /api/plants', () => {
  it('creates a plant and returns 201', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'p2', common_name: 'Pothos' }] })
    const req = new Request('http://localhost/api/plants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        common_name: 'Pothos',
        scientific_name: 'Epipremnum aureum',
        location: 'indoor',
        watering_interval_days: 7,
        repotting_interval_days: 365,
        fertilizing_interval_days: 30,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.common_name).toBe('Pothos')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest app/api/plants/__tests__/route.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement GET + POST handler**

Create `app/api/plants/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { ulid } from '@/lib/ulid'
import { nextCareDate } from '@/lib/care-dates'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const result = await db.execute({
    sql: `SELECT p.*, pp.blob_url AS primary_photo
          FROM plants p
          LEFT JOIN plant_photos pp ON pp.plant_id = p.id AND pp.is_primary = 1
          WHERE p.user_id = ?
          ORDER BY p.next_watering_at ASC`,
    args: [session.user.id],
  })
  return NextResponse.json(result.rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const id = ulid()
  const now = new Date().toISOString()
  const db = getDb()

  await db.execute({
    sql: `INSERT INTO plants (
            id, user_id, common_name, scientific_name, soil_id, location,
            watering_interval_days, repotting_interval_days, fertilizing_interval_days,
            next_watering_at, next_repotting_at, next_fertilizing_at, notes, created_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id, session.user.id, body.common_name, body.scientific_name ?? null,
      body.soil_id ?? null, body.location,
      body.watering_interval_days, body.repotting_interval_days, body.fertilizing_interval_days,
      nextCareDate(null, body.watering_interval_days),
      nextCareDate(null, body.repotting_interval_days),
      nextCareDate(null, body.fertilizing_interval_days),
      body.notes ?? null, now,
    ],
  })

  const plant = await db.execute({ sql: 'SELECT * FROM plants WHERE id = ?', args: [id] })
  return NextResponse.json(plant.rows[0], { status: 201 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest app/api/plants/__tests__/route.test.ts
```

Expected: PASS

- [ ] **Step 5: Write failing tests for GET/PATCH/DELETE by ID**

Create `app/api/plants/__tests__/id-route.test.ts`:
```ts
import { GET, PATCH, DELETE } from '../[id]/route'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))

const mockExecute = jest.fn()
jest.mock('@/lib/db', () => ({ getDb: jest.fn().mockReturnValue({ execute: mockExecute }) }))

const plant = { id: 'p1', user_id: 'user-1', common_name: 'Monstera' }

describe('GET /api/plants/[id]', () => {
  it('returns 404 when plant not owned by user', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] })
    const req = new Request('http://localhost/api/plants/p1')
    const res = await GET(req, { params: { id: 'p1' } })
    expect(res.status).toBe(404)
  })

  it('returns plant when found', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [plant] })
    const req = new Request('http://localhost/api/plants/p1')
    const res = await GET(req, { params: { id: 'p1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.common_name).toBe('Monstera')
  })
})

describe('DELETE /api/plants/[id]', () => {
  it('returns 204 on success', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [plant] })
      .mockResolvedValueOnce({ rows: [] })
    const req = new Request('http://localhost/api/plants/p1', { method: 'DELETE' })
    const res = await DELETE(req, { params: { id: 'p1' } })
    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 6: Run tests to verify they fail**

```bash
npx jest app/api/plants/__tests__/id-route.test.ts
```

Expected: FAIL

- [ ] **Step 7: Implement GET/PATCH/DELETE by ID**

Create `app/api/plants/[id]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'

type Params = { params: { id: string } }

async function getOwnedPlant(plantId: string, userId: string) {
  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM plants WHERE id = ? AND user_id = ?',
    args: [plantId, userId],
  })
  return result.rows[0] ?? null
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const plant = await getOwnedPlant(params.id, session.user.id)
  if (!plant) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(plant)
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const plant = await getOwnedPlant(params.id, session.user.id)
  if (!plant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const allowed = [
    'common_name','scientific_name','soil_id','location','notes',
    'watering_interval_days','repotting_interval_days','fertilizing_interval_days',
    'last_watered_at','last_repotted_at','last_fertilized_at',
    'next_watering_at','next_repotting_at','next_fertilizing_at',
  ]
  const fields = Object.keys(body).filter(k => allowed.includes(k))
  if (fields.length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 })

  const db = getDb()
  const setClauses = fields.map(f => `${f} = ?`).join(', ')
  await db.execute({
    sql: `UPDATE plants SET ${setClauses} WHERE id = ?`,
    args: [...fields.map(f => body[f]), params.id],
  })

  const updated = await db.execute({ sql: 'SELECT * FROM plants WHERE id = ?', args: [params.id] })
  return NextResponse.json(updated.rows[0])
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const plant = await getOwnedPlant(params.id, session.user.id)
  if (!plant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const db = getDb()
  await db.execute({ sql: 'DELETE FROM plants WHERE id = ?', args: [params.id] })
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 8: Run tests**

```bash
npx jest app/api/plants/__tests__/id-route.test.ts
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add app/api/plants/
git commit -m "feat: plant CRUD API routes"
```

---

## Task 5: Plant Feed UI

**Files:**
- Create: `app/(app)/layout.tsx`, `app/(app)/page.tsx`, `components/plant-card.tsx`, `components/fab.tsx`
- Test: `components/__tests__/plant-card.test.tsx`

- [ ] **Step 1: Write failing component test**

Create `components/__tests__/plant-card.test.tsx`:
```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { PlantCard } from '../plant-card'

jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children }: any) => <a href={href}>{children}</a> }))
jest.mock('next/image', () => ({ __esModule: true, default: ({ src, alt }: any) => <img src={src} alt={alt} /> }))

const plant = {
  id: 'p1',
  common_name: 'Monstera',
  scientific_name: 'Monstera deliciosa',
  next_watering_at: '2026-06-12T00:00:00.000Z',
  primary_photo: null,
}

describe('PlantCard', () => {
  it('renders plant name', () => {
    render(<PlantCard plant={plant} />)
    expect(screen.getByText('Monstera')).toBeInTheDocument()
  })

  it('shows next watering date', () => {
    render(<PlantCard plant={plant} />)
    expect(screen.getByText(/Jun 12/)).toBeInTheDocument()
  })

  it('links to plant detail page', () => {
    render(<PlantCard plant={plant} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/plants/p1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest components/__tests__/plant-card.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Create PlantCard**

Create `components/plant-card.tsx`:
```tsx
import Link from 'next/link'
import Image from 'next/image'

type Plant = {
  id: string
  common_name: string
  scientific_name?: string | null
  next_watering_at?: string | null
  primary_photo?: string | null
}

export function PlantCard({ plant }: { plant: Plant }) {
  const nextWater = plant.next_watering_at
    ? new Date(plant.next_watering_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <Link href={`/plants/${plant.id}`} className="flex gap-4 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-green-50 flex-shrink-0">
        {plant.primary_photo ? (
          <Image src={plant.primary_photo} alt={plant.common_name} width={64} height={64} className="object-cover w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl" aria-hidden>🌿</div>
        )}
      </div>
      <div className="flex flex-col justify-center">
        <p className="font-semibold text-gray-900">{plant.common_name}</p>
        {plant.scientific_name && <p className="text-xs text-gray-500 italic">{plant.scientific_name}</p>}
        {nextWater && <p className="text-xs text-blue-600 mt-1">Water by {nextWater}</p>}
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest components/__tests__/plant-card.test.tsx
```

Expected: PASS

- [ ] **Step 5: Create FAB**

Create `components/fab.tsx`:
```tsx
import Link from 'next/link'

export function FAB() {
  return (
    <Link
      href="/plants/new"
      className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-green-600 text-white text-3xl flex items-center justify-center shadow-lg hover:bg-green-700 transition-colors"
      aria-label="Add plant"
    >
      +
    </Link>
  )
}
```

- [ ] **Step 6: Create app layout**

Create `app/(app)/layout.tsx`:
```tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')
  return <>{children}</>
}
```

- [ ] **Step 7: Create plant feed page**

Create `app/(app)/page.tsx`:
```tsx
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PlantCard } from '@/components/plant-card'
import { FAB } from '@/components/fab'

export default async function FeedPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const db = getDb()
  const result = await db.execute({
    sql: `SELECT p.*, pp.blob_url AS primary_photo
          FROM plants p
          LEFT JOIN plant_photos pp ON pp.plant_id = p.id AND pp.is_primary = 1
          WHERE p.user_id = ?
          ORDER BY p.next_watering_at ASC`,
    args: [session.user.id],
  })
  const plants = result.rows as any[]

  return (
    <main className="max-w-lg mx-auto px-4 py-8 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Plants</h1>
        <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700">Settings</Link>
      </div>
      {plants.length === 0 ? (
        <p className="text-gray-500 text-center mt-16">No plants yet. Tap + to add one.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {plants.map(p => <PlantCard key={p.id} plant={p} />)}
        </div>
      )}
      <FAB />
    </main>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add app/\(app\)/ components/plant-card.tsx components/fab.tsx components/__tests__/plant-card.test.tsx
git commit -m "feat: plant feed with PlantCard, FAB, auth layout"
```

---

## Task 6: Photo Upload API

**Files:**
- Create: `lib/blob.ts`, `app/api/photos/route.ts`
- Test: `app/api/photos/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/api/photos/__tests__/route.test.ts`:
```ts
import { POST } from '../route'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))
jest.mock('@vercel/blob', () => ({
  put: jest.fn().mockResolvedValue({ url: 'https://blob.vercel.com/test.jpg' }),
}))
jest.mock('@/lib/db', () => ({
  getDb: jest.fn().mockReturnValue({ execute: jest.fn().mockResolvedValue({ rows: [] }) }),
}))

describe('POST /api/photos', () => {
  it('returns blob_url and 201 on success', async () => {
    const formData = new FormData()
    formData.append('plant_id', 'p1')
    formData.append('file', new Blob(['fake'], { type: 'image/jpeg' }), 'photo.jpg')
    formData.append('is_primary', 'true')
    const req = new Request('http://localhost/api/photos', { method: 'POST', body: formData })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.blob_url).toBe('https://blob.vercel.com/test.jpg')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest app/api/photos/__tests__/route.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create blob helper**

Create `lib/blob.ts`:
```ts
import { put } from '@vercel/blob'

export async function uploadPhoto(file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const { url } = await put(`plants/${userId}/${Date.now()}.${ext}`, file, { access: 'public' })
  return url
}
```

- [ ] **Step 4: Create photos route**

Create `app/api/photos/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { uploadPhoto } from '@/lib/blob'
import { ulid } from '@/lib/ulid'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const plantId = formData.get('plant_id') as string
  const isPrimary = formData.get('is_primary') === 'true' ? 1 : 0

  const blobUrl = await uploadPhoto(file, session.user.id)
  const id = ulid()
  const db = getDb()

  await db.execute({
    sql: `INSERT INTO plant_photos (id, plant_id, blob_url, is_primary) VALUES (?,?,?,?)`,
    args: [id, plantId, blobUrl, isPrimary],
  })

  return NextResponse.json({ id, blob_url: blobUrl }, { status: 201 })
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest app/api/photos/__tests__/route.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/blob.ts app/api/photos/
git commit -m "feat: photo upload to Vercel Blob"
```

---

## Task 7: Plant Identification (Claude Vision)

**Files:**
- Create: `lib/anthropic.ts`, `app/api/identify/route.ts`
- Test: `app/api/identify/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/api/identify/__tests__/route.test.ts`:
```ts
import { POST } from '../route'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))

const mockCreate = jest.fn().mockResolvedValue({
  content: [{
    type: 'text',
    text: JSON.stringify({
      common_name: 'Monstera',
      scientific_name: 'Monstera deliciosa',
      watering_interval_days: 7,
      repotting_interval_days: 365,
      fertilizing_interval_days: 30,
      suggested_soil_type: 'potting mix',
      location_preference: 'indoor',
    }),
  }],
})

jest.mock('@/lib/anthropic', () => ({
  getAnthropic: jest.fn().mockReturnValue({ messages: { create: mockCreate } }),
}))

describe('POST /api/identify', () => {
  it('returns structured plant data from Claude', async () => {
    const req = new Request('http://localhost/api/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'data:image/jpeg;base64,/9j/abc123' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.common_name).toBe('Monstera')
    expect(body.watering_interval_days).toBe(7)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest app/api/identify/__tests__/route.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create Anthropic client**

Create `lib/anthropic.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getAnthropic() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _client
}
```

- [ ] **Step 4: Create identify route**

Create `app/api/identify/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAnthropic } from '@/lib/anthropic'

const SYSTEM = `You are a plant identification expert. Given a photo, return ONLY a JSON object (no markdown) with:
- common_name: string
- scientific_name: string
- watering_interval_days: number
- repotting_interval_days: number
- fertilizing_interval_days: number
- suggested_soil_type: "potting mix" | "cactus mix" | "orchid mix" | "custom"
- location_preference: "indoor" | "outdoor" | "balcony" | "greenhouse"`

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { image } = await req.json()
  const [header, base64Data] = image.split(',')
  const mediaType = header.match(/data:([^;]+)/)?.[1] as 'image/jpeg' | 'image/png' | 'image/webp'

  const anthropic = getAnthropic()
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
        { type: 'text', text: 'Identify this plant.' },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return NextResponse.json(JSON.parse(text))
  } catch {
    return NextResponse.json({ error: 'Failed to parse Claude response', raw: text }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest app/api/identify/__tests__/route.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/anthropic.ts app/api/identify/
git commit -m "feat: plant identification via Claude vision API"
```

---

## Task 8: Identify Flow UI (Camera → Confirm Wizard)

**Files:**
- Create: `components/identify-flow.tsx`, `app/(app)/plants/new/page.tsx`
- Test: `components/__tests__/identify-flow.test.tsx`

- [ ] **Step 1: Write failing test**

Create `components/__tests__/identify-flow.test.tsx`:
```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { IdentifyFlow } from '../identify-flow'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('IdentifyFlow', () => {
  it('shows file input labeled "Take a photo" on mount', () => {
    render(<IdentifyFlow />)
    expect(screen.getByLabelText(/take a photo/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest components/__tests__/identify-flow.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Create IdentifyFlow component**

Create `components/identify-flow.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type PlantData = {
  common_name: string
  scientific_name: string
  watering_interval_days: number
  repotting_interval_days: number
  fertilizing_interval_days: number
  suggested_soil_type: string
  location_preference: string
}

type Step = 'capture' | 'confirm' | 'saving'

export function IdentifyFlow() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('capture')
  const [preview, setPreview] = useState<string | null>(null)
  const [form, setForm] = useState<PlantData | null>(null)
  const [identifying, setIdentifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setPreview(dataUrl)
      setIdentifying(true)
      setError(null)
      try {
        const res = await fetch('/api/identify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl }),
        })
        if (!res.ok) throw new Error('Identification failed')
        const data: PlantData = await res.json()
        setForm(data)
        setStep('confirm')
      } catch {
        setError('Could not identify plant. Please try again.')
      } finally {
        setIdentifying(false)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!form || !preview) return
    setStep('saving')

    const plantRes = await fetch('/api/plants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        common_name: form.common_name,
        scientific_name: form.scientific_name,
        location: form.location_preference,
        watering_interval_days: form.watering_interval_days,
        repotting_interval_days: form.repotting_interval_days,
        fertilizing_interval_days: form.fertilizing_interval_days,
      }),
    })
    if (!plantRes.ok) { setStep('confirm'); return }
    const plant = await plantRes.json()

    const blob = await fetch(preview).then(r => r.blob())
    const fd = new FormData()
    fd.append('plant_id', plant.id)
    fd.append('file', blob, 'photo.jpg')
    fd.append('is_primary', 'true')
    await fetch('/api/photos', { method: 'POST', body: fd })

    router.push(`/plants/${plant.id}`)
  }

  if (step === 'capture') {
    return (
      <div className="flex flex-col items-center gap-6 p-8">
        <h1 className="text-xl font-bold">Add a Plant</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {identifying ? (
          <p className="text-gray-500 animate-pulse">Identifying plant...</p>
        ) : (
          <label
            htmlFor="photo-input"
            className="cursor-pointer flex flex-col items-center gap-3 border-2 border-dashed border-green-400 rounded-2xl p-12 text-green-600 hover:border-green-600"
          >
            <span className="text-5xl" aria-hidden>📷</span>
            <span className="font-medium">Take a photo</span>
            <input
              id="photo-input"
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleFile}
            />
          </label>
        )}
        {preview && <img src={preview} alt="preview" className="w-40 h-40 object-cover rounded-xl" />}
      </div>
    )
  }

  if (step === 'confirm' && form) {
    return (
      <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
        <h1 className="text-xl font-bold">Confirm Plant Details</h1>
        {preview && <img src={preview} alt="plant" className="w-full h-48 object-cover rounded-2xl" />}
        {[
          { label: 'Common name', key: 'common_name', type: 'text' },
          { label: 'Scientific name', key: 'scientific_name', type: 'text' },
          { label: 'Water every (days)', key: 'watering_interval_days', type: 'number' },
          { label: 'Repot every (days)', key: 'repotting_interval_days', type: 'number' },
          { label: 'Fertilize every (days)', key: 'fertilizing_interval_days', type: 'number' },
        ].map(({ label, key, type }) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">{label}</span>
            <input
              type={type}
              className="border rounded-lg px-3 py-2"
              value={(form as any)[key]}
              onChange={e => setForm({ ...form, [key]: type === 'number' ? +e.target.value : e.target.value })}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Location</span>
          <select
            className="border rounded-lg px-3 py-2"
            value={form.location_preference}
            onChange={e => setForm({ ...form, location_preference: e.target.value })}
          >
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
            <option value="balcony">Balcony</option>
            <option value="greenhouse">Greenhouse</option>
          </select>
        </label>
        <button onClick={handleSave} className="mt-2 bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700">
          Save Plant
        </button>
      </div>
    )
  }

  return <p className="text-center text-gray-500 mt-16 animate-pulse">Saving...</p>
}
```

- [ ] **Step 4: Create new plant page**

Create `app/(app)/plants/new/page.tsx`:
```tsx
import { IdentifyFlow } from '@/components/identify-flow'

export default function NewPlantPage() {
  return <IdentifyFlow />
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest components/__tests__/identify-flow.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/identify-flow.tsx app/\(app\)/plants/new/ components/__tests__/identify-flow.test.tsx
git commit -m "feat: camera → Claude identify → confirm wizard"
```

---

## Task 9: Streaming Care Tips (SSE)

**Files:**
- Create: `app/api/tips/[id]/route.ts`, `components/tips-stream.tsx`
- Test: `app/api/tips/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/api/tips/__tests__/route.test.ts`:
```ts
import { GET } from '../[id]/route'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))
jest.mock('@/lib/db', () => ({
  getDb: jest.fn().mockReturnValue({
    execute: jest.fn().mockResolvedValue({
      rows: [{
        id: 'p1', user_id: 'user-1', common_name: 'Monstera',
        scientific_name: 'Monstera deliciosa', location: 'indoor',
        last_watered_at: null, last_repotted_at: null, last_fertilized_at: null,
      }],
    }),
  }),
}))

const mockStream = {
  async *[Symbol.asyncIterator]() {
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Water weekly.' } }
  },
}
jest.mock('@/lib/anthropic', () => ({
  getAnthropic: jest.fn().mockReturnValue({ messages: { stream: jest.fn().mockReturnValue(mockStream) } }),
}))

describe('GET /api/tips/[id]', () => {
  it('returns 200 with text/event-stream content type', async () => {
    const req = new Request('http://localhost/api/tips/p1')
    const res = await GET(req, { params: { id: 'p1' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest app/api/tips/__tests__/route.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create tips streaming route**

Create `app/api/tips/[id]/route.ts`:
```ts
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { getAnthropic } from '@/lib/anthropic'

type Params = { params: { id: string } }

function buildPrompt(plant: any): string {
  const month = new Date().toLocaleString('en-US', { month: 'long' })
  return `Give a 2-3 sentence care tip for this plant right now.

Plant: ${plant.common_name} (${plant.scientific_name ?? 'unknown'})
Location: ${plant.location} | Month: ${month}
Last watered: ${plant.last_watered_at ?? 'never'}
Last repotted: ${plant.last_repotted_at ?? 'never'}
Last fertilized: ${plant.last_fertilized_at ?? 'never'}

Be specific and actionable.`
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM plants WHERE id = ? AND user_id = ?',
    args: [params.id, session.user.id],
  })
  const plant = result.rows[0]
  if (!plant) return new Response('Not found', { status: 404 })

  const anthropic = getAnthropic()
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: buildPrompt(plant) }],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
        }
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest app/api/tips/__tests__/route.test.ts
```

Expected: PASS

- [ ] **Step 5: Create TipsStream client component**

Create `components/tips-stream.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'

export function TipsStream({ plantId }: { plantId: string }) {
  const [text, setText] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const es = new EventSource(`/api/tips/${plantId}`)
    es.onmessage = (e) => {
      if (e.data === '[DONE]') { setDone(true); es.close(); return }
      const { text: chunk } = JSON.parse(e.data)
      setText(prev => prev + chunk)
    }
    return () => es.close()
  }, [plantId])

  if (!text && !done) {
    return <p className="text-gray-400 text-sm animate-pulse">Loading tip...</p>
  }
  return (
    <div className="bg-green-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
      {text}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/tips/ components/tips-stream.tsx app/api/tips/__tests__/
git commit -m "feat: streaming care tips via SSE"
```

---

## Task 10: Plant Detail Page

**Files:**
- Create: `app/(app)/plants/[id]/page.tsx`, `components/photo-timeline.tsx`, `components/care-buttons.tsx`
- Test: `components/__tests__/care-buttons.test.tsx`

- [ ] **Step 1: Write failing test**

Create `components/__tests__/care-buttons.test.tsx`:
```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CareButtons } from '../care-buttons'

global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

describe('CareButtons', () => {
  it('renders water, repot, and fertilize buttons', () => {
    render(<CareButtons plantId="p1" onLogged={jest.fn()} />)
    expect(screen.getByText(/water/i)).toBeInTheDocument()
    expect(screen.getByText(/repot/i)).toBeInTheDocument()
    expect(screen.getByText(/fertilize/i)).toBeInTheDocument()
  })

  it('calls POST /api/care-logs when water is tapped', async () => {
    render(<CareButtons plantId="p1" onLogged={jest.fn()} />)
    fireEvent.click(screen.getByText(/water/i))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/care-logs', expect.objectContaining({ method: 'POST' }))
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest components/__tests__/care-buttons.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Create CareButtons component**

Create `components/care-buttons.tsx`:
```tsx
'use client'
import { useState } from 'react'

type Props = { plantId: string; onLogged: () => void }

const BUTTONS = [
  { type: 'water', label: '💧 Water' },
  { type: 'repot', label: '🪴 Repot' },
  { type: 'fertilize', label: '🌱 Fertilize' },
] as const

export function CareButtons({ plantId, onLogged }: Props) {
  const [loading, setLoading] = useState<string | null>(null)

  async function log(type: 'water' | 'repot' | 'fertilize') {
    setLoading(type)
    await fetch('/api/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: plantId, type }),
    })
    setLoading(null)
    onLogged()
  }

  return (
    <div className="flex gap-3">
      {BUTTONS.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => log(type)}
          disabled={loading === type}
          className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-sm font-medium hover:bg-green-50 disabled:opacity-50"
        >
          {loading === type ? '...' : label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest components/__tests__/care-buttons.test.tsx
```

Expected: PASS

- [ ] **Step 5: Create PhotoTimeline component**

Create `components/photo-timeline.tsx`:
```tsx
import Image from 'next/image'

type Photo = { id: string; blob_url: string; taken_at: string }

export function PhotoTimeline({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return null
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {photos.map(photo => (
        <div key={photo.id} className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-gray-100">
          <Image src={photo.blob_url} alt="" width={96} height={96} className="object-cover w-full h-full" />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Create plant detail page**

Create `app/(app)/plants/[id]/page.tsx`:
```tsx
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TipsStream } from '@/components/tips-stream'
import { PhotoTimeline } from '@/components/photo-timeline'
import { CareButtons } from '@/components/care-buttons'

type Params = { params: { id: string } }

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

export default async function PlantDetailPage({ params }: Params) {
  const session = await auth()
  if (!session) redirect('/login')

  const db = getDb()
  const [plantResult, photosResult] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM plants WHERE id = ? AND user_id = ?', args: [params.id, session.user.id] }),
    db.execute({ sql: 'SELECT * FROM plant_photos WHERE plant_id = ? ORDER BY taken_at ASC', args: [params.id] }),
  ])

  const plant = plantResult.rows[0]
  if (!plant) redirect('/')
  const photos = photosResult.rows as any[]

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <Link href="/" className="text-green-600 text-sm mb-4 block">← Back</Link>
      <h1 className="text-2xl font-bold mb-1">{plant.common_name as string}</h1>
      {plant.scientific_name && (
        <p className="text-gray-500 italic text-sm mb-4">{plant.scientific_name as string}</p>
      )}

      <PhotoTimeline photos={photos} />

      <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-blue-700 font-medium">Next water</p>
          <p className="text-gray-700">{fmt(plant.next_watering_at as string)}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-3">
          <p className="text-yellow-700 font-medium">Next repot</p>
          <p className="text-gray-700">{fmt(plant.next_repotting_at as string)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3">
          <p className="text-green-700 font-medium">Next feed</p>
          <p className="text-gray-700">{fmt(plant.next_fertilizing_at as string)}</p>
        </div>
      </div>

      <div className="mt-6">
        <CareButtons plantId={params.id} onLogged={() => {}} />
      </div>

      <div className="mt-6">
        <h2 className="font-semibold text-gray-800 mb-2">Care Tip</h2>
        <TipsStream plantId={params.id} />
      </div>

      <div className="mt-6">
        <Link
          href={`/plants/${params.id}/chat`}
          className="block w-full text-center py-3 border border-green-600 text-green-600 rounded-xl hover:bg-green-50"
        >
          Chat about this plant →
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/plants/\[id\]/page.tsx components/photo-timeline.tsx components/care-buttons.tsx components/__tests__/care-buttons.test.tsx
git commit -m "feat: plant detail page with photo timeline, care schedule, streaming tips"
```

---

## Task 11: Care Logs API

**Files:**
- Create: `app/api/care-logs/route.ts`
- Test: `app/api/care-logs/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/api/care-logs/__tests__/route.test.ts`:
```ts
import { POST } from '../route'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))

const mockExecute = jest.fn()
jest.mock('@/lib/db', () => ({ getDb: jest.fn().mockReturnValue({ execute: mockExecute }) }))

describe('POST /api/care-logs', () => {
  beforeEach(() => mockExecute.mockReset())

  it('logs a water event and returns 201', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'user-1', watering_interval_days: 7 }] }) // fetch plant
      .mockResolvedValueOnce({ rows: [] }) // insert care_log
      .mockResolvedValueOnce({ rows: [] }) // update plant
    const req = new Request('http://localhost/api/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: 'p1', type: 'water' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('logs a fertilize event into fertilizer_logs and returns 201', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'user-1', fertilizing_interval_days: 30 }] }) // fetch plant
      .mockResolvedValueOnce({ rows: [] }) // insert fertilizer_log
      .mockResolvedValueOnce({ rows: [] }) // update plant
    const req = new Request('http://localhost/api/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: 'p1', type: 'fertilize' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 for invalid type', async () => {
    const req = new Request('http://localhost/api/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: 'p1', type: 'prune' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest app/api/care-logs/__tests__/route.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create care-logs route**

Create `app/api/care-logs/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { ulid } from '@/lib/ulid'
import { nextCareDate } from '@/lib/care-dates'

type CareType = 'water' | 'repot' | 'fertilize'

const INTERVAL: Record<CareType, string> = {
  water: 'watering_interval_days',
  repot: 'repotting_interval_days',
  fertilize: 'fertilizing_interval_days',
}
const LAST: Record<CareType, string> = {
  water: 'last_watered_at',
  repot: 'last_repotted_at',
  fertilize: 'last_fertilized_at',
}
const NEXT: Record<CareType, string> = {
  water: 'next_watering_at',
  repot: 'next_repotting_at',
  fertilize: 'next_fertilizing_at',
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plant_id, type, notes } = await req.json() as { plant_id: string; type: string; notes?: string }
  if (!['water', 'repot', 'fertilize'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  const careType = type as CareType

  const db = getDb()
  const plantResult = await db.execute({
    sql: 'SELECT * FROM plants WHERE id = ? AND user_id = ?',
    args: [plant_id, session.user.id],
  })
  const plant = plantResult.rows[0]
  if (!plant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date().toISOString()
  const interval = plant[INTERVAL[careType]] as number
  const next = nextCareDate(now, interval)

  if (careType === 'fertilize') {
    // Write to fertilizer_logs (fertilizer_id is nullable for ad-hoc logs)
    await db.execute({
      sql: `INSERT INTO fertilizer_logs (id, plant_id, fertilizer_id, fed_at, dosage, dosage_unit, notes) VALUES (?,?,?,?,?,?,?)`,
      args: [ulid(), plant_id, null, now, null, null, notes ?? null],
    })
    await db.execute({
      sql: `UPDATE plants SET last_fertilized_at = ?, next_fertilizing_at = ? WHERE id = ?`,
      args: [now, next, plant_id],
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  }

  await db.execute({
    sql: `INSERT INTO care_logs (id, plant_id, type, logged_at, notes) VALUES (?,?,?,?,?)`,
    args: [ulid(), plant_id, careType, now, notes ?? null],
  })
  await db.execute({
    sql: `UPDATE plants SET ${LAST[careType]} = ?, ${NEXT[careType]} = ? WHERE id = ?`,
    args: [now, next, plant_id],
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest app/api/care-logs/__tests__/route.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/care-logs/
git commit -m "feat: care log API — water/repot/fertilize with next-date updates"
```

---

## Task 12: Per-Plant Chat (Streaming)

**Files:**
- Create: `app/api/chat/[id]/route.ts`, `components/chat-interface.tsx`, `app/(app)/plants/[id]/chat/page.tsx`
- Test: `app/api/chat/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/api/chat/__tests__/route.test.ts`:
```ts
import { POST } from '../[id]/route'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))
jest.mock('@/lib/db', () => ({
  getDb: jest.fn().mockReturnValue({
    execute: jest.fn().mockResolvedValue({
      rows: [{ id: 'p1', user_id: 'user-1', common_name: 'Monstera', scientific_name: null, location: 'indoor', last_watered_at: null, last_fertilized_at: null }],
    }),
  }),
}))

const mockStream = {
  async *[Symbol.asyncIterator]() {
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Water every 7 days.' } }
  },
}
jest.mock('@/lib/anthropic', () => ({
  getAnthropic: jest.fn().mockReturnValue({ messages: { stream: jest.fn().mockReturnValue(mockStream) } }),
}))

describe('POST /api/chat/[id]', () => {
  it('returns 200 with text/event-stream', async () => {
    const req = new Request('http://localhost/api/chat/p1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'How often do I water?' }] }),
    })
    const res = await POST(req, { params: { id: 'p1' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest app/api/chat/__tests__/route.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create chat route**

Create `app/api/chat/[id]/route.ts`:
```ts
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { getAnthropic } from '@/lib/anthropic'

type Params = { params: { id: string } }
type Message = { role: 'user' | 'assistant'; content: string }

function buildSystem(plant: any): string {
  const month = new Date().toLocaleString('en-US', { month: 'long' })
  return `You are a plant care assistant specializing in ${plant.common_name}${plant.scientific_name ? ` (${plant.scientific_name})` : ''}.
Location: ${plant.location} | Month: ${month}
Last watered: ${plant.last_watered_at ?? 'never'} | Last fertilized: ${plant.last_fertilized_at ?? 'never'}
Answer questions about this plant concisely and helpfully.`
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM plants WHERE id = ? AND user_id = ?',
    args: [params.id, session.user.id],
  })
  const plant = result.rows[0]
  if (!plant) return new Response('Not found', { status: 404 })

  const { messages }: { messages: Message[] } = await req.json()
  const anthropic = getAnthropic()
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: buildSystem(plant),
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
        }
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest app/api/chat/__tests__/route.test.ts
```

Expected: PASS

- [ ] **Step 5: Create ChatInterface component**

Create `components/chat-interface.tsx`:
```tsx
'use client'
import { useState, useRef, useEffect } from 'react'

type Message = { role: 'user' | 'assistant'; content: string }

export function ChatInterface({ plantId }: { plantId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setLoading(true)

    const res = await fetch(`/api/chat/${plantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    })

    setMessages(prev => [...prev, { role: 'assistant', content: '' }])
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let assistantText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const line of decoder.decode(value).split('\n')) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') break
        assistantText += JSON.parse(data).text
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: assistantText }
          return next
        })
      }
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center mt-8">Ask anything about your plant</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'self-end bg-green-600 text-white' : 'self-start bg-gray-100 text-gray-800'}`}
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-4 flex gap-2">
        <input
          className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about your plant..."
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create chat page**

Create `app/(app)/plants/[id]/chat/page.tsx`:
```tsx
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChatInterface } from '@/components/chat-interface'

type Params = { params: { id: string } }

export default async function ChatPage({ params }: Params) {
  const session = await auth()
  if (!session) redirect('/login')

  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM plants WHERE id = ? AND user_id = ?',
    args: [params.id, session.user.id],
  })
  const plant = result.rows[0]
  if (!plant) redirect('/')

  return (
    <main className="flex flex-col h-screen max-w-lg mx-auto">
      <header className="border-b px-4 py-3 flex items-center gap-3">
        <Link href={`/plants/${params.id}`} className="text-green-600 text-sm">← Back</Link>
        <h1 className="font-semibold">{plant.common_name as string}</h1>
      </header>
      <ChatInterface plantId={params.id} />
    </main>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add app/api/chat/ components/chat-interface.tsx app/\(app\)/plants/\[id\]/chat/ app/api/chat/__tests__/
git commit -m "feat: per-plant streaming chat with Claude"
```

---

## Task 13: PWA Manifest + Service Worker

**Files:**
- Create: `public/manifest.json`, `public/sw.js`, `public/icons/` (placeholder icons)
- Update: `app/layout.tsx`

- [ ] **Step 1: Create PWA manifest**

Create `public/manifest.json`:
```json
{
  "name": "Plant Tracker",
  "short_name": "Plants",
  "description": "Track and care for your houseplants",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#16a34a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Create service worker**

Create `public/sw.js`:
```js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Plant Tracker', {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
})

const CACHE = 'plant-tracker-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/login'])))
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/')))
  }
})
```

- [ ] **Step 3: Generate placeholder PWA icons**

```bash
mkdir -p public/icons
# Requires ImageMagick — if unavailable, use any 192×192 and 512×512 green PNG
convert -size 192x192 xc:#16a34a public/icons/icon-192.png
convert -size 512x512 xc:#16a34a public/icons/icon-512.png
```

If ImageMagick is not installed:
```bash
# Download simple placeholder pngs
curl -s "https://placehold.co/192x192/16a34a/ffffff.png" -o public/icons/icon-192.png
curl -s "https://placehold.co/512x512/16a34a/ffffff.png" -o public/icons/icon-512.png
```

- [ ] **Step 4: Update root layout**

Replace `app/layout.tsx` with:
```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Plant Tracker',
  description: 'Track and care for your houseplants',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#16a34a" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={inter.className}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(console.error)}`,
          }}
        />
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add public/ app/layout.tsx
git commit -m "feat: PWA manifest, service worker, push notification handler"
```

---

## Task 14: Push Notifications — VAPID + Subscribe API

**Files:**
- Create: `lib/push.ts`, `app/api/notifications/subscribe/route.ts`, `components/notification-toggle.tsx`
- Test: `lib/__tests__/push.test.ts`

- [ ] **Step 1: Generate VAPID keys (one-time)**

```bash
npx web-push generate-vapid-keys
```

Copy the output into `.env.local`:
```
VAPID_PUBLIC_KEY=<public-key-output>
VAPID_PRIVATE_KEY=<private-key-output>
VAPID_SUBJECT=mailto:you@example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same-as-VAPID_PUBLIC_KEY>
```

- [ ] **Step 2: Write failing test for push helper**

Create `lib/__tests__/push.test.ts`:
```ts
import { sendPush } from '@/lib/push'

const mockSendNotification = jest.fn().mockResolvedValue(undefined)
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: mockSendNotification,
}))

describe('sendPush', () => {
  it('calls sendNotification with the correct subscription shape', async () => {
    const sub = { endpoint: 'https://push.example.com', p256dh: 'key123', auth: 'secret456' }
    await sendPush(sub, { title: 'Water Monstera', body: 'Time to water!', url: '/plants/p1' })
    expect(mockSendNotification).toHaveBeenCalledWith(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title: 'Water Monstera', body: 'Time to water!', url: '/plants/p1' })
    )
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest lib/__tests__/push.test.ts
```

Expected: FAIL

- [ ] **Step 4: Create push helper**

Create `lib/push.ts`:
```ts
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

type PushSub = { endpoint: string; p256dh: string; auth: string }
type PushPayload = { title: string; body: string; url: string }

export async function sendPush(sub: PushSub, payload: PushPayload): Promise<void> {
  await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload)
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest lib/__tests__/push.test.ts
```

Expected: PASS

- [ ] **Step 6: Create subscribe route**

Create `app/api/notifications/subscribe/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { ulid } from '@/lib/ulid'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint, keys }: { endpoint: string; keys: { p256dh: string; auth: string } } = await req.json()
  const db = getDb()

  await db.execute({
    sql: `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
          VALUES (?,?,?,?,?)
          ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id`,
    args: [ulid(), session.user.id, endpoint, keys.p256dh, keys.auth],
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
```

- [ ] **Step 7: Create NotificationToggle component**

Create `components/notification-toggle.tsx`:
```tsx
'use client'
import { useState, useEffect } from 'react'

type Status = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export function NotificationToggle() {
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported'); return
    }
    if (Notification.permission === 'denied') { setStatus('denied'); return }
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setStatus(sub ? 'subscribed' : 'unsubscribed'))
    )
  }, [])

  async function subscribe() {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    })
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    })
    setStatus('subscribed')
  }

  if (status === 'loading') return null
  if (status === 'unsupported') return <p className="text-sm text-gray-400">Push not supported on this browser.</p>
  if (status === 'denied') return <p className="text-sm text-red-500">Notifications blocked. Enable in browser settings.</p>
  if (status === 'subscribed') return <p className="text-sm text-green-600">✓ Notifications enabled</p>
  return (
    <button
      onClick={subscribe}
      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
    >
      Enable push notifications
    </button>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/push.ts lib/__tests__/push.test.ts app/api/notifications/ components/notification-toggle.tsx
git commit -m "feat: VAPID push subscription and web-push helper"
```

---

## Task 15: Settings Page

**Files:**
- Create: `app/(app)/settings/page.tsx`

- [ ] **Step 1: Create settings page**

Create `app/(app)/settings/page.tsx`:
```tsx
import { auth, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { NotificationToggle } from '@/components/notification-toggle'

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <Link href="/" className="text-green-600 text-sm mb-4 block">← Back</Link>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <section className="bg-white rounded-2xl shadow-sm p-6 mb-4">
        <h2 className="font-semibold mb-1">{session.user.name}</h2>
        <p className="text-sm text-gray-500 mb-4">{session.user.email}</p>
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <button type="submit" className="text-sm text-red-500 hover:underline">
            Sign out
          </button>
        </form>
      </section>

      <section className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold mb-3">Notifications</h2>
        <NotificationToggle />
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/settings/
git commit -m "feat: settings page with push opt-in and sign-out"
```

---

## Task 16: Daily Cron — Claude Nudge + Push

**Files:**
- Create: `app/api/cron/notify/route.ts`, `vercel.json`
- Test: `app/api/cron/__tests__/notify.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/api/cron/__tests__/notify.test.ts`:
```ts
const mockExecute = jest.fn()
const mockSendPush = jest.fn().mockResolvedValue(undefined)
const mockCreate = jest.fn().mockResolvedValue({
  content: [{ type: 'text', text: JSON.stringify({ adjusted_days: 0, notification_body: 'Time to water!' }) }],
})

jest.mock('@/lib/db', () => ({ getDb: jest.fn().mockReturnValue({ execute: mockExecute }) }))
jest.mock('@/lib/push', () => ({ sendPush: mockSendPush }))
jest.mock('@/lib/anthropic', () => ({ getAnthropic: jest.fn().mockReturnValue({ messages: { create: mockCreate } }) }))

import { GET } from '../notify/route'

describe('GET /api/cron/notify', () => {
  beforeEach(() => mockExecute.mockReset())

  it('returns 200 with count of processed plants', async () => {
    const today = new Date().toISOString().slice(0, 10)
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'u1', common_name: 'Monstera', location: 'indoor', next_watering_at: today }] })
      .mockResolvedValueOnce({ rows: [{ endpoint: 'https://push.example.com', p256dh: 'k', auth: 'a' }] })
    const req = new Request('http://localhost/api/cron/notify')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest app/api/cron/__tests__/notify.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create cron notify route**

Create `app/api/cron/notify/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getAnthropic } from '@/lib/anthropic'
import { sendPush } from '@/lib/push'

const NUDGE_SYSTEM = `You are a plant care assistant. Given a plant due for care, return ONLY a JSON object:
{"adjusted_days": number, "notification_body": string}
adjusted_days: -2 to 2 (0 = no change, based on season/species)
notification_body: max 100 chars, actionable`

async function getNudge(plant: any): Promise<{ adjusted_days: number; notification_body: string }> {
  const month = new Date().toLocaleString('en-US', { month: 'long' })
  const anthropic = getAnthropic()
  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 128,
      system: NUDGE_SYSTEM,
      messages: [{ role: 'user', content: `Plant: ${plant.common_name}, Location: ${plant.location}, Month: ${month}` }],
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : '{}'
    return JSON.parse(text)
  } catch {
    return { adjusted_days: 0, notification_body: `Time to care for your ${plant.common_name}` }
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)

  const dueResult = await db.execute({
    sql: `SELECT * FROM plants WHERE date(next_watering_at) <= date(?)
          OR date(next_repotting_at) <= date(?)
          OR date(next_fertilizing_at) <= date(?)`,
    args: [today, today, today],
  })

  let processed = 0
  for (const plant of dueResult.rows) {
    const nudge = await getNudge(plant)

    const subsResult = await db.execute({
      sql: 'SELECT * FROM push_subscriptions WHERE user_id = ?',
      args: [plant.user_id],
    })

    for (const sub of subsResult.rows) {
      await sendPush(
        { endpoint: sub.endpoint as string, p256dh: sub.p256dh as string, auth: sub.auth as string },
        { title: `${plant.common_name} needs attention`, body: nudge.notification_body, url: `/plants/${plant.id}` }
      ).catch(() => {})
    }

    if (nudge.adjusted_days !== 0) {
      const adjusted = new Date(today)
      adjusted.setDate(adjusted.getDate() + nudge.adjusted_days)
      const iso = adjusted.toISOString()
      const update: string[] = []
      const args: any[] = []
      if ((plant.next_watering_at as string | null)?.startsWith(today)) { update.push('next_watering_at = ?'); args.push(iso) }
      if ((plant.next_repotting_at as string | null)?.startsWith(today)) { update.push('next_repotting_at = ?'); args.push(iso) }
      if ((plant.next_fertilizing_at as string | null)?.startsWith(today)) { update.push('next_fertilizing_at = ?'); args.push(iso) }
      if (update.length > 0) {
        await db.execute({ sql: `UPDATE plants SET ${update.join(', ')} WHERE id = ?`, args: [...args, plant.id] })
      }
    }
    processed++
  }

  return NextResponse.json({ processed })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest app/api/cron/__tests__/notify.test.ts
```

Expected: PASS

- [ ] **Step 5: Create Vercel Cron config**

Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/notify",
      "schedule": "0 9 * * *"
    }
  ]
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/ vercel.json
git commit -m "feat: daily cron — Claude nudge + VAPID push for due plants"
```

---

## Task 17: Full Test Suite + Type Check

- [ ] **Step 1: Run all tests**

```bash
npx jest
```

Expected: All tests PASS. If any fail, fix them before proceeding.

- [ ] **Step 2: TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: No errors. Fix any type errors before proceeding.

- [ ] **Step 3: Start dev server and verify core flows manually**

```bash
npm run dev
```

With real credentials in `.env.local`, verify:
- `/` redirects to `/login` when not authenticated
- Google OAuth sign-in succeeds and redirects to feed
- Feed shows empty state with FAB and Settings link
- Tapping FAB opens camera/file input
- Dev server console shows no errors

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore: plant tracker v1 complete"
```
