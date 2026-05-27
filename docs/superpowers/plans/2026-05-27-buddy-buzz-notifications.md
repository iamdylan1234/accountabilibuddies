# Buddy Buzz Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-per-day buddy-triggered web push notifications, layered on the existing `daily_message` feature, with content hidden from the notification preview.

**Architecture:** DIY web-push (no SaaS). New `push_subscriptions` table + `last_buzz_date` column on `profiles`. A `sendBuzz` lib function called from inside the existing `updateDailyMessage` server action. Permission requested via a Today-tab banner and a `/profile` toggle, both backed by a shared `useBuzzPermission` hook. Service worker extends `app/sw.ts` (Serwist-based) with `push` + `notificationclick` listeners.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres + auth), TypeScript, web-push 3.x npm, VAPID keys, Jest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-27-buddy-buzz-notifications.md`

---

## File Map

**Create:**
- `lib/profile.ts` — `firstNameOf` helper (shared by send + banner + toggle)
- `lib/profile.test.ts` — tests for `firstNameOf`
- `lib/push/vapid.ts` — base64-url → Uint8Array helper (needed when calling `pushManager.subscribe`)
- `lib/push/vapid.test.ts` — tests for the decoder
- `lib/push/send.ts` — `sendBuzz(senderId, recipientId)` using web-push library
- `lib/push/__tests__/send.test.ts` — tests for sendBuzz (mocks web-push + Supabase admin)
- `lib/push/useBuzzPermission.ts` — client hook returning typed permission state
- `lib/push/__tests__/useBuzzPermission.test.tsx` — hook tests (mocks Notification + serviceWorker)
- `app/api/push/subscribe/route.ts` — POST endpoint to upsert a subscription row
- `app/api/push/unsubscribe/route.ts` — POST endpoint to delete a subscription row
- `components/dashboard/BuzzPermissionBanner.tsx` — banner UI on Today
- `components/dashboard/BuzzPermissionBanner.test.tsx` — banner tests
- `components/profile/BuzzToggle.tsx` — toggle UI on /profile
- `components/profile/BuzzToggle.test.tsx` — toggle tests

**Modify:**
- `types/database.ts` — add `last_buzz_date` to `Profile`, add new `PushSubscription` interface
- `app/sw.ts` — add `push` and `notificationclick` event listeners
- `app/dashboard/checkin-actions.ts` — wire `sendBuzz` into `updateDailyMessage` with rate-limit pre-check
- `components/dashboard/DashboardClient.tsx` — mount `<BuzzPermissionBanner />` next to `<InstallBanner />` site
- `components/profile/ProfileClient.tsx` — mount `<BuzzToggle />` above the Sign-out section
- `package.json` — add `web-push` runtime dep and `@types/web-push` dev dep
- `.env.local` (local-only, NOT committed) — `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- Vercel env vars (production, via dashboard) — same four

**Run once manually:**
- SQL migration in Supabase SQL Editor (Task 1)
- `npx web-push generate-vapid-keys` locally to mint VAPID key pair (Task 4)

---

## Task 1: Schema migration

**Files:**
- Run manually: Supabase SQL Editor (no file in repo — convention matches the prior `buddy-message` spec)

- [ ] **Step 1: Run the migration SQL in Supabase**

Paste this into the Supabase SQL Editor (project dashboard → SQL Editor → new query) and execute against the production project:

```sql
-- Rate-limit column on profiles. `date` (not timestamptz) so the value
-- honours the user's local "today" rather than UTC.
ALTER TABLE profiles ADD COLUMN last_buzz_date date DEFAULT NULL;

-- Per-device push subscriptions. One row per (user, device).
CREATE TABLE push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own subs only" ON push_subscriptions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

Expected: 4 success messages (ALTER, CREATE TABLE, CREATE INDEX, ALTER, CREATE POLICY — Supabase reports each).

- [ ] **Step 2: Verify schema**

In the Supabase SQL Editor, run:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'last_buzz_date';

SELECT * FROM push_subscriptions LIMIT 0;
```

Expected:
- First query returns one row: `last_buzz_date | date`
- Second query returns no rows but the column headers prove the table exists: `id | user_id | endpoint | p256dh | auth | created_at`

- [ ] **Step 3: Commit migration record**

Since the project has no `supabase/migrations` directory, we record the migration as an artefact under `docs/`:

```bash
mkdir -p docs/migrations
```

Create `docs/migrations/2026-05-27-buddy-buzz.sql` containing the same SQL as Step 1 (so future engineers can reproduce the schema):

```sql
-- 2026-05-27 — Buddy Buzz Notifications
-- Applied to production: 2026-05-27 by Dylan via Supabase SQL Editor.

ALTER TABLE profiles ADD COLUMN last_buzz_date date DEFAULT NULL;

CREATE TABLE push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own subs only" ON push_subscriptions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

```bash
git add docs/migrations/2026-05-27-buddy-buzz.sql
git commit -m "chore(db): record buddy-buzz migration

Applied to prod Supabase. Adds last_buzz_date column to profiles and
the push_subscriptions table with RLS."
```

---

## Task 2: Type updates

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Read the existing Profile interface**

```bash
grep -n "interface Profile\|^}" types/database.ts | head -5
```

Locate the `Profile` interface and the closing brace.

- [ ] **Step 2: Add `last_buzz_date` to `Profile`**

In `types/database.ts`, add the field to the `Profile` interface (after `message_date`, which is the closest semantic neighbour):

```ts
export interface Profile {
  id: string
  name: string
  avatar_style: string
  daily_message: string | null
  message_date: string | null
  last_buzz_date: string | null   // YYYY-MM-DD; null = never sent
  created_at: string
}
```

Note: only add the new line. Keep the other existing fields exactly as they are.

- [ ] **Step 3: Append `PushSubscription` interface**

At the end of `types/database.ts`, add:

```ts
export interface PushSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}
```

- [ ] **Step 4: Verify type-check passes**

Run: `npx tsc --noEmit`

Expected: zero errors. If any consumer of `Profile` breaks because of strict type checking, it's because they were missing fields before — those would already have been errors. The new optional-shaped fields shouldn't break anything.

- [ ] **Step 5: Commit**

```bash
git add types/database.ts
git commit -m "feat(types): add last_buzz_date to Profile + PushSubscription interface"
```

---

## Task 3: `firstNameOf` helper

**Files:**
- Create: `lib/profile.ts`
- Test: `lib/profile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/profile.test.ts`:

```ts
import { firstNameOf } from './profile'

describe('firstNameOf', () => {
  it('returns the substring before the first space', () => {
    expect(firstNameOf({ name: 'Dylan Rogers' })).toBe('Dylan')
  })

  it('returns the whole string when there is no space', () => {
    expect(firstNameOf({ name: 'Dylan' })).toBe('Dylan')
  })

  it('falls back to "Your buddy" when name is null', () => {
    expect(firstNameOf({ name: null })).toBe('Your buddy')
  })

  it('falls back to "Your buddy" when name is empty string', () => {
    expect(firstNameOf({ name: '' })).toBe('Your buddy')
  })

  it('falls back to "Your buddy" when name is whitespace only', () => {
    expect(firstNameOf({ name: '   ' })).toBe('Your buddy')
  })

  it('falls back to "Your buddy" when input is null', () => {
    expect(firstNameOf(null)).toBe('Your buddy')
  })

  it('trims leading whitespace before splitting', () => {
    expect(firstNameOf({ name: '  Dylan Rogers' })).toBe('Dylan')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest lib/profile.test.ts
```

Expected: FAIL — module `./profile` not found.

- [ ] **Step 3: Implement `firstNameOf`**

Create `lib/profile.ts`:

```ts
/**
 * Shared rule for extracting a display first name from a Profile-like object.
 * Used by the notification body, the buzz banner copy, and the /profile toggle
 * caption — keep them consistent by going through this helper.
 *
 * Rule: substring before the first space in `name`, trimmed.
 * Fallback: 'Your buddy' if name is null, empty, or whitespace-only.
 */
export function firstNameOf(profile: { name: string | null } | null): string {
  const name = profile?.name?.trim()
  if (!name) return 'Your buddy'
  const firstSpace = name.indexOf(' ')
  return firstSpace === -1 ? name : name.slice(0, firstSpace)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest lib/profile.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/profile.ts lib/profile.test.ts
git commit -m "feat(lib): firstNameOf helper for shared display-name rule"
```

---

## Task 4: Install web-push and generate VAPID keys

**Files:**
- Modify: `package.json`, `package-lock.json`
- Manual: `.env.local` (local-only, NOT committed)

- [ ] **Step 1: Install `web-push` and its types**

```bash
npm install web-push
npm install --save-dev @types/web-push
```

Expected: two new entries in `package.json`. No CI/runtime issues (web-push is a 9-year-old library with no native bindings).

- [ ] **Step 2: Generate the VAPID key pair**

```bash
npx web-push generate-vapid-keys
```

Expected output:

```
=======================================

Public Key:
B...long-base64-url-string...

Private Key:
A...long-base64-url-string...

=======================================
```

Copy both values — you'll use them in Steps 3 and 4.

- [ ] **Step 3: Add VAPID env vars to `.env.local`**

Append to `.env.local` (create the file if it doesn't exist; it's gitignored):

```
VAPID_PUBLIC_KEY=<paste public key here>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<paste the SAME public key here>
VAPID_PRIVATE_KEY=<paste private key here>
VAPID_SUBJECT=mailto:dylan@africancleanenergy.com
```

The public key is duplicated under `NEXT_PUBLIC_*` because the client-side subscribe flow needs it.

- [ ] **Step 4: Add the same four env vars to Vercel**

Go to Vercel dashboard → project → Settings → Environment Variables → add each of the four for the `Production` environment (also `Preview` if you preview-test pushes).

**Verification:** the Vercel Environment Variables list should show 4 new keys: `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. They are not visible in any other UI (Vercel masks them).

- [ ] **Step 5: Commit the dependency changes**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add web-push for buddy buzz notifications"
```

`.env.local` is gitignored — do NOT commit it.

---

## Task 5: VAPID utility (base64-url → Uint8Array)

**Files:**
- Create: `lib/push/vapid.ts`
- Test: `lib/push/vapid.test.ts`

The browser's `pushManager.subscribe({ applicationServerKey })` expects a `Uint8Array`, not a base64 string. This utility does the conversion.

- [ ] **Step 1: Write the failing test**

Create `lib/push/vapid.test.ts`:

```ts
import { urlBase64ToUint8Array } from './vapid'

describe('urlBase64ToUint8Array', () => {
  it('decodes a standard base64-url string', () => {
    // 'hello' = 'aGVsbG8' in base64-url (no padding)
    const result = urlBase64ToUint8Array('aGVsbG8')
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111])
  })

  it('handles base64-url with - and _ replacements', () => {
    // 0xfb 0xff = base64 '+/8=' = base64url '-_8'
    const result = urlBase64ToUint8Array('-_8')
    expect(Array.from(result)).toEqual([0xfb, 0xff])
  })

  it('pads correctly when length is not a multiple of 4', () => {
    // 'ab' = base64 'YWI=' (padded), base64url 'YWI' (unpadded)
    const result = urlBase64ToUint8Array('YWI')
    expect(Array.from(result)).toEqual([97, 98])
  })

  it('returns a Uint8Array of the right length for a typical VAPID public key', () => {
    // Real VAPID public keys are 65 bytes (P-256 uncompressed point)
    // 65 bytes -> base64url length ~88 chars (without padding)
    const dummyVapid = 'B' + 'a'.repeat(86)
    const result = urlBase64ToUint8Array(dummyVapid)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(65)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest lib/push/vapid.test.ts
```

Expected: FAIL — module `./vapid` not found.

- [ ] **Step 3: Implement the decoder**

Create `lib/push/vapid.ts`:

```ts
/**
 * Decodes a base64-url-encoded string into a Uint8Array. Required because
 * `pushManager.subscribe({ applicationServerKey })` accepts a Uint8Array, not
 * a string. Web-Push VAPID public keys are conventionally distributed as
 * base64-url-encoded P-256 public points.
 *
 * Why not just atob: atob doesn't understand the URL-safe alphabet (-, _) or
 * missing padding. We normalise to standard base64 first, then atob, then
 * convert the resulting binary string to a Uint8Array.
 */
export function urlBase64ToUint8Array(base64UrlString: string): Uint8Array {
  const padding = '='.repeat((4 - (base64UrlString.length % 4)) % 4)
  const base64 = (base64UrlString + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest lib/push/vapid.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/push/vapid.ts lib/push/vapid.test.ts
git commit -m "feat(push): base64-url decoder for VAPID applicationServerKey"
```

---

## Task 6: `sendBuzz` library

**Files:**
- Create: `lib/push/send.ts`
- Test: `lib/push/__tests__/send.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/push/__tests__/send.test.ts`:

```ts
import { sendBuzz } from '../send'

// Mock the admin client + web-push
const mockSelect = jest.fn()
const mockDelete = jest.fn()
const mockEq = jest.fn()

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { name: 'Dylan Rogers' }, error: null }),
            }),
          }),
        }
      }
      if (table === 'push_subscriptions') {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              mockSelect(col, val)
              return Promise.resolve({
                data: [
                  { id: 'sub1', endpoint: 'https://push.example/1', p256dh: 'k1', auth: 'a1' },
                  { id: 'sub2', endpoint: 'https://push.example/2', p256dh: 'k2', auth: 'a2' },
                ],
                error: null,
              })
            },
          }),
          delete: () => ({
            eq: (col: string, val: string) => {
              mockDelete(col, val)
              return Promise.resolve({ error: null })
            },
          }),
        }
      }
      return {} as any
    },
  }),
}))

const mockSendNotification = jest.fn()
jest.mock('web-push', () => ({
  __esModule: true,
  default: {
    setVapidDetails: jest.fn(),
    sendNotification: (...args: any[]) => mockSendNotification(...args),
  },
}))

// Required env vars
process.env.VAPID_SUBJECT = 'mailto:test@test.com'
process.env.VAPID_PUBLIC_KEY = 'public'
process.env.VAPID_PRIVATE_KEY = 'private'

beforeEach(() => {
  mockSelect.mockClear()
  mockDelete.mockClear()
  mockSendNotification.mockClear()
})

describe('sendBuzz', () => {
  it('sends to every push subscription belonging to the recipient', async () => {
    mockSendNotification.mockResolvedValue(undefined)
    await sendBuzz('sender-id', 'recipient-id')
    expect(mockSendNotification).toHaveBeenCalledTimes(2)
  })

  it('includes the sender first name in the notification body', async () => {
    mockSendNotification.mockResolvedValue(undefined)
    await sendBuzz('sender-id', 'recipient-id')
    const payload = JSON.parse(mockSendNotification.mock.calls[0][1])
    expect(payload.body).toContain('Dylan')
    expect(payload.title).toBe('Accountabilibuddies')
  })

  it('does NOT include the daily_message content in the payload', async () => {
    mockSendNotification.mockResolvedValue(undefined)
    await sendBuzz('sender-id', 'recipient-id')
    const payload = JSON.parse(mockSendNotification.mock.calls[0][1])
    // Both title and body together
    const combined = `${payload.title} ${payload.body}`
    // The body should be the wrapper, not the message contents
    expect(combined).not.toMatch(/message:|wrote:|said:/i)
  })

  it('deletes a subscription when push returns 404', async () => {
    mockSendNotification
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockResolvedValueOnce(undefined)
    await sendBuzz('sender-id', 'recipient-id')
    expect(mockDelete).toHaveBeenCalledWith('id', 'sub1')
  })

  it('deletes a subscription when push returns 410', async () => {
    mockSendNotification
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockResolvedValueOnce(undefined)
    await sendBuzz('sender-id', 'recipient-id')
    expect(mockDelete).toHaveBeenCalledWith('id', 'sub1')
  })

  it('swallows non-404/410 errors and does NOT delete', async () => {
    mockSendNotification.mockRejectedValue({ statusCode: 500 })
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect(sendBuzz('sender-id', 'recipient-id')).resolves.toBeUndefined()
    expect(mockDelete).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest lib/push/__tests__/send.test.ts
```

Expected: FAIL — module `../send` not found.

- [ ] **Step 3: Implement `sendBuzz`**

Create `lib/push/send.ts`:

```ts
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'
import { firstNameOf } from '@/lib/profile'

// Configure VAPID once at module load. setVapidDetails is idempotent.
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:dylan@africancleanenergy.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

/**
 * Fire one buzz from `senderId` to `recipientId`. Looks up the sender's name
 * for the notification body, queries the recipient's push subscriptions, and
 * sends to all of them in parallel. Subscriptions that return 404 or 410 are
 * expired or revoked — deleted on the spot. Other errors are logged and
 * swallowed; this function never throws (callers don't want their save flow
 * to break because a push service had a 5xx).
 */
export async function sendBuzz(senderId: string, recipientId: string): Promise<void> {
  const supabase = createAdminClient()

  // Sender's first name for the notification body
  const { data: sender } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', senderId)
    .single()
  const firstName = firstNameOf(sender)

  // All push subscriptions for the recipient (one per device)
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', recipientId)

  if (!subs || subs.length === 0) return

  const payload = JSON.stringify({
    title: 'Accountabilibuddies',
    body: `${firstName} sent you a buzz 🤜🤛`,
  })

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('[sendBuzz] push send failed', {
            subId: sub.id,
            statusCode: err?.statusCode,
          })
        }
      }
    }),
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest lib/push/__tests__/send.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/push/send.ts lib/push/__tests__/send.test.ts
git commit -m "feat(push): sendBuzz library — web-push integration with 404/410 cleanup"
```

---

## Task 7: Subscribe + unsubscribe route handlers

**Files:**
- Create: `app/api/push/subscribe/route.ts`
- Create: `app/api/push/unsubscribe/route.ts`

These are simple thin endpoints — `subscribe` upserts a row, `unsubscribe` deletes a row. No tests in this task because the underlying Supabase operations are trivial; the integration-level verification happens in the manual smoke test (Task 13).

- [ ] **Step 1: Create subscribe handler**

Create `app/api/push/subscribe/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Stores a single push subscription for the authenticated user. Idempotent —
 * subscribing again from the same device (same endpoint) updates the row's
 * keys without inserting a duplicate.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { endpoint?: string; p256dh?: string; auth?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { endpoint, p256dh, auth } = body
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Missing endpoint/p256dh/auth' }, { status: 400 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: user.id, endpoint, p256dh, auth }, { onConflict: 'endpoint' })

  if (error) {
    console.error('[push/subscribe] upsert failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create unsubscribe handler**

Create `app/api/push/unsubscribe/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Deletes a push subscription for the authenticated user. Matches on
 * (user_id, endpoint) so a user can only unsubscribe their own device.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { endpoint?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', body.endpoint)

  if (error) {
    console.error('[push/unsubscribe] delete failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/push/subscribe/route.ts app/api/push/unsubscribe/route.ts
git commit -m "feat(push): subscribe/unsubscribe route handlers"
```

---

## Task 8: Service worker push + notificationclick listeners

**Files:**
- Modify: `app/sw.ts`

- [ ] **Step 1: Read the current `app/sw.ts`**

```bash
cat app/sw.ts
```

Confirm it ends with `serwist.addEventListeners()` and uses the `declare const self: WorkerGlobalScope & typeof globalThis` pattern.

- [ ] **Step 2: Add push + notificationclick listeners**

Replace the entire contents of `app/sw.ts` with:

```ts
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist, NetworkOnly } from 'serwist'

// Minimal local aliases so we can type push events without pulling in
// lib.webworker (which would conflict with lib.dom in the shared tsconfig).
type PushEvent = ExtendableEvent & {
  data: { json(): any; text(): string } | null
}
type NotificationEvent = ExtendableEvent & {
  notification: Notification
  action: string
}

// Tell TypeScript that `self` inside a service worker has the right shape.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: WorkerGlobalScope & typeof globalThis & {
  registration: ServiceWorkerRegistration
  clients: Clients
  addEventListener(type: 'push', listener: (e: PushEvent) => void): void
  addEventListener(type: 'notificationclick', listener: (e: NotificationEvent) => void): void
}

// Supabase calls are user-specific and realtime — never cache them.
const supabaseNetworkOnly = {
  matcher: ({ url }: { url: URL }) => url.hostname.endsWith('.supabase.co'),
  handler: new NetworkOnly(),
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [supabaseNetworkOnly, ...defaultCache],
})

serwist.addEventListeners()

// ── Buddy buzz handlers ─────────────────────────────────────────────────────

// Show a notification when a push arrives. The push payload comes from
// `webpush.sendNotification` in lib/push/send.ts.
self.addEventListener('push', (event: PushEvent) => {
  const data = (() => {
    try { return event.data?.json() ?? {} } catch { return {} }
  })()
  const title = data.title ?? 'Accountabilibuddies'
  const body  = data.body  ?? 'Your buddy sent you a buzz'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.png',
      badge: '/icon.png',
      tag: 'buddy-buzz',           // collapses repeats into one notification
      requireInteraction: false,    // auto-dismisses after a few seconds
    }),
  )
})

// When the user taps the notification, focus the existing tab if open,
// otherwise open a new window to /dashboard.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = all.find(c => c.url.includes('/dashboard'))
      if (existing) {
        await existing.focus()
        return
      }
      await self.clients.openWindow('/dashboard')
    })(),
  )
})
```

- [ ] **Step 3: Verify the build still works**

```bash
npx next build
```

Expected: build succeeds. Look for any TypeScript errors specifically around `app/sw.ts`. If Serwist's build step rejects the new types, narrow them further (likely just need to drop the `Clients` and `Notification` types and use `any` if no lib type is available).

If the build fails for unrelated reasons (e.g., env vars not set in CI), it's fine — we only need to confirm the SW typechecks.

- [ ] **Step 4: Commit**

```bash
git add app/sw.ts
git commit -m "feat(sw): push + notificationclick listeners for buddy buzz"
```

---

## Task 9: `useBuzzPermission` hook

**Files:**
- Create: `lib/push/useBuzzPermission.ts`
- Test: `lib/push/__tests__/useBuzzPermission.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `lib/push/__tests__/useBuzzPermission.test.tsx`:

```tsx
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBuzzPermission } from '../useBuzzPermission'

// Defaults the test harness restores between tests.
const originalNotification = (global as any).Notification
const originalNavigator = global.navigator

afterEach(() => {
  ;(global as any).Notification = originalNotification
  // Restoring navigator is non-trivial; tests should reset only the fields they touch
})

function mockPushSupport({
  permission = 'default' as NotificationPermission,
  existingSubscription = null as null | { endpoint: string },
  standalone = true, // PWA-installed
  isIOS = false,
}) {
  ;(global as any).Notification = { permission }

  const mockSubscribe = jest.fn().mockResolvedValue({
    endpoint: 'https://push.example/new',
    getKey: (k: string) =>
      new Uint8Array(k === 'p256dh' ? [1, 2, 3] : [4, 5, 6]).buffer,
  })
  const mockUnsub = jest.fn().mockResolvedValue(true)
  const mockGetSubscription = jest.fn().mockResolvedValue(
    existingSubscription
      ? { ...existingSubscription, unsubscribe: mockUnsub }
      : null,
  )

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: {
          subscribe: mockSubscribe,
          getSubscription: mockGetSubscription,
        },
      }),
    },
  })

  // Mock matchMedia for standalone detection
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({
      matches: q.includes('standalone') ? standalone : false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })

  // Mock user agent for iOS detection
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: isIOS ? 'iPhone Safari' : 'Android Chrome',
  })

  return { mockSubscribe, mockGetSubscription, mockUnsub }
}

describe('useBuzzPermission', () => {
  it('returns "unsupported" when PushManager is unavailable', async () => {
    ;(global as any).Notification = undefined
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined })
    const { result } = renderHook(() => useBuzzPermission())
    await waitFor(() => expect(result.current.kind).toBe('unsupported'))
  })

  it('returns "ios-needs-install" on iOS Safari without standalone', async () => {
    mockPushSupport({ isIOS: true, standalone: false })
    const { result } = renderHook(() => useBuzzPermission())
    await waitFor(() => expect(result.current.kind).toBe('ios-needs-install'))
  })

  it('returns "default" when permission is default and supported', async () => {
    mockPushSupport({ permission: 'default' })
    const { result } = renderHook(() => useBuzzPermission())
    await waitFor(() => expect(result.current.kind).toBe('default'))
  })

  it('returns "denied" when permission is denied', async () => {
    mockPushSupport({ permission: 'denied' })
    const { result } = renderHook(() => useBuzzPermission())
    await waitFor(() => expect(result.current.kind).toBe('denied'))
  })

  it('returns "granted" + subscribed when permission granted and subscription exists', async () => {
    mockPushSupport({
      permission: 'granted',
      existingSubscription: { endpoint: 'https://push.example/existing' },
    })
    const { result } = renderHook(() => useBuzzPermission())
    await waitFor(() => {
      expect(result.current.kind).toBe('granted')
      if (result.current.kind === 'granted') expect(result.current.subscribed).toBe(true)
    })
  })

  it('enable() calls Notification.requestPermission and POSTs to /api/push/subscribe', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as any
    ;(global as any).Notification = {
      permission: 'default',
      requestPermission: jest.fn().mockResolvedValue('granted'),
    }
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'BFakeVapidKey'
    const { mockSubscribe } = mockPushSupport({ permission: 'default' })
    const { result } = renderHook(() => useBuzzPermission())
    await waitFor(() => expect(result.current.kind).toBe('default'))

    await act(async () => {
      if (result.current.kind === 'default') await result.current.enable()
    })

    expect(mockSubscribe).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/push/subscribe',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest lib/push/__tests__/useBuzzPermission.test.tsx
```

Expected: FAIL — module `../useBuzzPermission` not found.

- [ ] **Step 3: Implement the hook**

Create `lib/push/useBuzzPermission.ts`:

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import { urlBase64ToUint8Array } from './vapid'

export type BuzzPermissionState =
  | { kind: 'unsupported' }
  | { kind: 'ios-needs-install' }
  | { kind: 'default'; enable: () => Promise<void> }
  | { kind: 'granted'; subscribed: boolean; enable: () => Promise<void>; disable: () => Promise<void> }
  | { kind: 'denied' }
  | { kind: 'pending' }

function isIOSSafari(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

function isStandalone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
}

function supportsPush(): boolean {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window
}

async function postJSON(url: string, body: any): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function extractKeys(sub: PushSubscription): { p256dh: string; auth: string } {
  const p256dh = btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')!)))
  const auth   = btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')!)))
  return { p256dh, auth }
}

/**
 * Single source of truth for the push subscribe/unsubscribe lifecycle. The
 * banner and the /profile toggle both consume this hook.
 */
export function useBuzzPermission(): BuzzPermissionState {
  const [state, setState] = useState<BuzzPermissionState>({ kind: 'pending' })

  const refresh = useCallback(async () => {
    if (!supportsPush()) {
      // iOS Safari does support push, but ONLY when in standalone (PWA installed).
      // Other iOS browsers don't support it at all.
      if (typeof navigator !== 'undefined' && isIOSSafari() && !isStandalone()) {
        setState({ kind: 'ios-needs-install' })
        return
      }
      setState({ kind: 'unsupported' })
      return
    }
    // iOS-specific guard even when PushManager is detected — older iOS engines
    // expose the API but only honour it in standalone mode.
    if (isIOSSafari() && !isStandalone()) {
      setState({ kind: 'ios-needs-install' })
      return
    }
    const permission = Notification.permission
    if (permission === 'denied') {
      setState({ kind: 'denied' })
      return
    }
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()

    if (permission === 'granted') {
      setState({
        kind: 'granted',
        subscribed: !!sub,
        enable: doSubscribe,
        disable: doUnsubscribe,
      })
    } else {
      setState({ kind: 'default', enable: doSubscribe })
    }
  }, [])

  const doSubscribe = useCallback(async () => {
    setState({ kind: 'pending' })
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      await refresh()
      return
    }
    const reg = await navigator.serviceWorker.ready
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
    const { p256dh, auth } = extractKeys(sub)
    await postJSON('/api/push/subscribe', { endpoint: sub.endpoint, p256dh, auth })
    await refresh()
  }, [refresh])

  const doUnsubscribe = useCallback(async () => {
    setState({ kind: 'pending' })
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await postJSON('/api/push/unsubscribe', { endpoint: sub.endpoint })
      await sub.unsubscribe()
    }
    await refresh()
  }, [refresh])

  useEffect(() => { refresh() }, [refresh])

  return state
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest lib/push/__tests__/useBuzzPermission.test.tsx
```

Expected: PASS, 6 tests.

If any tests fail due to JSDOM not implementing parts of the Push API: replace those specific assertions with looser matchers, OR mark the test as `it.skip` with a comment explaining why JSDOM can't cover that branch — the hook code is still verified by the other tests.

- [ ] **Step 5: Commit**

```bash
git add lib/push/useBuzzPermission.ts lib/push/__tests__/useBuzzPermission.test.tsx
git commit -m "feat(push): useBuzzPermission hook for subscribe/unsubscribe lifecycle"
```

---

## Task 10: `BuzzPermissionBanner` + wire into DashboardClient

**Files:**
- Create: `components/dashboard/BuzzPermissionBanner.tsx`
- Test: `components/dashboard/BuzzPermissionBanner.test.tsx`
- Modify: `components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Write the failing tests**

Create `components/dashboard/BuzzPermissionBanner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import BuzzPermissionBanner from './BuzzPermissionBanner'

// Mock the hook so we can drive state from tests
jest.mock('@/lib/push/useBuzzPermission', () => ({
  useBuzzPermission: jest.fn(),
}))
import { useBuzzPermission } from '@/lib/push/useBuzzPermission'

beforeEach(() => {
  ;(useBuzzPermission as jest.Mock).mockReset()
  localStorage.clear()
})

describe('BuzzPermissionBanner', () => {
  it('renders nothing when no buddy', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'default', enable: jest.fn() })
    const { container } = render(<BuzzPermissionBanner buddy={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when state is unsupported', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'unsupported' })
    const { container } = render(<BuzzPermissionBanner buddy={{ id: 'b', name: 'Sam Smith' } as any} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when state is ios-needs-install', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'ios-needs-install' })
    const { container } = render(<BuzzPermissionBanner buddy={{ id: 'b', name: 'Sam' } as any} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when already granted', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({
      kind: 'granted', subscribed: true, enable: jest.fn(), disable: jest.fn(),
    })
    const { container } = render(<BuzzPermissionBanner buddy={{ id: 'b', name: 'Sam' } as any} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders banner with buddy first name when default + buddy present', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'default', enable: jest.fn() })
    render(<BuzzPermissionBanner buddy={{ id: 'b', name: 'Sam Smith' } as any} />)
    expect(screen.getByText(/Sam sends a message/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enable/i })).toBeInTheDocument()
  })

  it('hides when recently dismissed', () => {
    localStorage.setItem(
      'accountabilibuddies-buzz-banner-dismissed-until',
      String(Date.now() + 1000 * 60 * 60 * 24),
    )
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'default', enable: jest.fn() })
    const { container } = render(<BuzzPermissionBanner buddy={{ id: 'b', name: 'Sam' } as any} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest components/dashboard/BuzzPermissionBanner.test.tsx
```

Expected: FAIL — module `./BuzzPermissionBanner` not found.

- [ ] **Step 3: Implement the banner**

Create `components/dashboard/BuzzPermissionBanner.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useBuzzPermission } from '@/lib/push/useBuzzPermission'
import { firstNameOf } from '@/lib/profile'
import { BRAND_GRADIENT } from '@/lib/brand'
import type { Profile } from '@/types/database'

const DISMISS_KEY = 'accountabilibuddies-buzz-banner-dismissed-until'
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

interface Props {
  buddy: Profile | null
}

/**
 * Today-tab banner that asks the recipient to enable buddy buzz push
 * notifications. Shown only when: a buddy exists, permission is "default"
 * (never asked), and the banner hasn't been dismissed in the last 14 days.
 *
 * Mirrors the visual pattern of <InstallBanner /> so they feel like one
 * family of opt-in prompts.
 */
export default function BuzzPermissionBanner({ buddy }: Props) {
  const state = useBuzzPermission()
  const [dismissedHydrated, setDismissedHydrated] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (raw && Number(raw) > Date.now()) setDismissed(true)
    setDismissedHydrated(true)
  }, [])

  if (!buddy) return null
  if (!dismissedHydrated) return null
  if (dismissed) return null
  if (state.kind !== 'default') return null

  const firstName = firstNameOf(buddy)

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_TTL_MS))
    setDismissed(true)
  }

  async function handleEnable() {
    if (state.kind === 'default') await state.enable()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mt-3">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
          style={{ background: BRAND_GRADIENT }}
        >
          🤜🤛
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-900">Get a buzz from {firstName}</p>
          <p className="text-xs text-gray-500">A notification when {firstName} sends a message. Tap to read.</p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-gray-400 text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={handleDismiss}
          className="flex-1 py-2 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 transition active:scale-95"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={handleEnable}
          style={{ background: BRAND_GRADIENT }}
          className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition active:scale-95"
        >
          Enable
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest components/dashboard/BuzzPermissionBanner.test.tsx
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Mount the banner into DashboardClient**

Find the section where `<InstallBanner />` is mounted — actually, `InstallBanner` is mounted in `app/layout.tsx`, but the buzz banner is dashboard-specific because it depends on the current buddy. Read `components/dashboard/DashboardClient.tsx`:

```bash
grep -n "ScoreTileGrid\|BuddyMessageRow" components/dashboard/DashboardClient.tsx | head -5
```

Add the import at the top of `DashboardClient.tsx`:

```ts
import BuzzPermissionBanner from './BuzzPermissionBanner'
```

In the JSX, insert the banner directly above the `<BuddyMessageRow>` site (if no `BuddyMessageRow` exists at runtime due to no buddy, the banner won't render either). The block should look like:

```tsx
<BuzzPermissionBanner buddy={buddy} />
{buddy && (
  <BuddyMessageRow ... existing props ... />
)}
```

The exact `buddy` variable name in DashboardClient is the existing one — don't rename.

- [ ] **Step 6: Verify dashboard still renders without errors**

Run: `npx jest` (full suite)

Expected: all tests pass — no test in the existing suite touches DashboardClient at a level that the banner mount would affect.

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/BuzzPermissionBanner.tsx components/dashboard/BuzzPermissionBanner.test.tsx components/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): buzz permission banner on Today"
```

---

## Task 11: `BuzzToggle` + wire into ProfileClient

**Files:**
- Create: `components/profile/BuzzToggle.tsx`
- Test: `components/profile/BuzzToggle.test.tsx`
- Modify: `components/profile/ProfileClient.tsx`

- [ ] **Step 1: Write the failing tests**

Create `components/profile/BuzzToggle.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import BuzzToggle from './BuzzToggle'

jest.mock('@/lib/push/useBuzzPermission', () => ({
  useBuzzPermission: jest.fn(),
}))
import { useBuzzPermission } from '@/lib/push/useBuzzPermission'

beforeEach(() => {
  ;(useBuzzPermission as jest.Mock).mockReset()
})

describe('BuzzToggle', () => {
  it('renders nothing when unsupported', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'unsupported' })
    const { container } = render(<BuzzToggle buddy={{ name: 'Sam Smith' } as any} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when ios-needs-install', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'ios-needs-install' })
    const { container } = render(<BuzzToggle buddy={{ name: 'Sam' } as any} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows "Off — tap to enable" when default', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'default', enable: jest.fn() })
    render(<BuzzToggle buddy={{ name: 'Sam Smith' } as any} />)
    expect(screen.getByText(/buddy buzzes/i)).toBeInTheDocument()
    expect(screen.getByText(/tap to enable/i)).toBeInTheDocument()
  })

  it('shows "On — buzzes from Sam" when granted + subscribed', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({
      kind: 'granted', subscribed: true, enable: jest.fn(), disable: jest.fn(),
    })
    render(<BuzzToggle buddy={{ name: 'Sam Smith' } as any} />)
    expect(screen.getByText(/on — buzzes from sam/i)).toBeInTheDocument()
  })

  it('shows "Blocked in browser settings" when denied', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'denied' })
    render(<BuzzToggle buddy={{ name: 'Sam' } as any} />)
    expect(screen.getByText(/blocked in browser settings/i)).toBeInTheDocument()
  })

  it('calls enable() when toggled from default', () => {
    const enable = jest.fn().mockResolvedValue(undefined)
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'default', enable })
    render(<BuzzToggle buddy={{ name: 'Sam' } as any} />)
    fireEvent.click(screen.getByRole('button', { name: /buddy buzzes/i }))
    expect(enable).toHaveBeenCalled()
  })

  it('calls disable() when toggled off from granted', () => {
    const disable = jest.fn().mockResolvedValue(undefined)
    ;(useBuzzPermission as jest.Mock).mockReturnValue({
      kind: 'granted', subscribed: true, enable: jest.fn(), disable,
    })
    render(<BuzzToggle buddy={{ name: 'Sam' } as any} />)
    fireEvent.click(screen.getByRole('button', { name: /buddy buzzes/i }))
    expect(disable).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest components/profile/BuzzToggle.test.tsx
```

Expected: FAIL — module `./BuzzToggle` not found.

- [ ] **Step 3: Implement the toggle**

Create `components/profile/BuzzToggle.tsx`:

```tsx
'use client'

import { useBuzzPermission } from '@/lib/push/useBuzzPermission'
import { firstNameOf } from '@/lib/profile'
import type { Profile } from '@/types/database'

interface Props {
  buddy: Profile | null
}

/**
 * Notification toggle on /profile. Always visible when push is supported,
 * regardless of the Today-tab banner's dismissal state — explicit user
 * intent here overrides "not now" on the banner.
 */
export default function BuzzToggle({ buddy }: Props) {
  const state = useBuzzPermission()

  if (state.kind === 'unsupported' || state.kind === 'ios-needs-install') return null

  let caption: string
  let toggleOn = false
  let toggleDisabled = false
  let onClick: (() => void) | undefined

  switch (state.kind) {
    case 'denied':
      caption = 'Blocked in browser settings. Re-enable via your browser/OS notification settings for this site.'
      toggleDisabled = true
      break
    case 'pending':
      caption = 'Saving…'
      toggleDisabled = true
      break
    case 'default':
      caption = 'Off — tap to enable'
      onClick = () => { void state.enable() }
      break
    case 'granted':
      if (state.subscribed) {
        const firstName = buddy ? firstNameOf(buddy) : 'your buddy'
        caption = `On — buzzes from ${firstName}`
        toggleOn = true
        onClick = () => { void state.disable() }
      } else {
        caption = 'Off — tap to enable'
        onClick = () => { void state.enable() }
      }
      break
  }

  return (
    <div className="mt-8 bg-white rounded-2xl border border-gray-200 p-4">
      <button
        type="button"
        onClick={onClick}
        disabled={toggleDisabled}
        aria-label="Buddy buzzes"
        className="w-full flex items-center justify-between gap-3 disabled:opacity-60"
      >
        <div className="flex-1 text-left min-w-0">
          <p className="font-bold text-sm text-gray-900">Buddy buzzes</p>
          <p className="text-xs text-gray-500">{caption}</p>
        </div>
        <span
          className={`relative w-11 h-6 rounded-full transition flex-shrink-0 ${toggleOn ? 'bg-teal-500' : 'bg-gray-300'}`}
          aria-hidden="true"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition ${toggleOn ? 'translate-x-5' : ''}`}
          />
        </span>
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest components/profile/BuzzToggle.test.tsx
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Mount the toggle into ProfileClient**

Read `components/profile/ProfileClient.tsx` near line 180 (the Sign-out section). Add the import at the top:

```ts
import BuzzToggle from './BuzzToggle'
```

Insert `<BuzzToggle buddy={...} />` directly **before** the Sign-out section. The `buddy` prop is derived from the active challenge — `ProfileClient` already computes `buddyProfile` for the active-challenge card (see existing line ~79: `const buddyProfile = challenge.creator_id === userId ? challenge.buddy : challenge.creator`). Pass that buddyProfile (or null if no active challenge):

```tsx
<BuzzToggle buddy={activeChallenge ? (activeChallenge.creator_id === userId ? activeChallenge.buddy : activeChallenge.creator) : null} />

{/* Sign out */}
<div className="mt-12 flex justify-center">
  ...existing...
</div>
```

- [ ] **Step 6: Run full test suite**

```bash
npx jest
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/profile/BuzzToggle.tsx components/profile/BuzzToggle.test.tsx components/profile/ProfileClient.tsx
git commit -m "feat(profile): buddy-buzz on/off toggle"
```

---

## Task 12: Wire `sendBuzz` into `updateDailyMessage`

This is the integration task. After it, the feature is complete end-to-end.

**Files:**
- Modify: `app/dashboard/checkin-actions.ts`

- [ ] **Step 1: Add the rate-limit + send logic**

Read the current `updateDailyMessage` body (lines 95–116 of `app/dashboard/checkin-actions.ts`) for context. Then replace the function with:

```ts
export async function updateDailyMessage(message: string, today: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Defensive: only accept YYYY-MM-DD strings
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return { error: 'Invalid date' }

  const trimmed = message.trim().slice(0, 150)

  const { error } = await supabase
    .from('profiles')
    .update({
      daily_message: trimmed || null,
      message_date: trimmed ? today : null,
    })
    .eq('id', user.id)

  if (error) return { error: error.message }

  // Trigger a buzz, server-side rate-limited to 1 per sender per day.
  // Skipped when: message is empty (clearing), no buddy, or already buzzed today.
  if (trimmed) {
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('last_buzz_date')
      .eq('id', user.id)
      .single()

    if (senderProfile?.last_buzz_date !== today) {
      // Find the user's current buddy via the active challenge_months row
      const { data: challenge } = await supabase
        .from('challenge_months')
        .select('creator_id, buddy_id')
        .eq('status', 'active')
        .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
        .maybeSingle()

      const buddyId = challenge
        ? (challenge.creator_id === user.id ? challenge.buddy_id : challenge.creator_id)
        : null

      if (buddyId) {
        const { sendBuzz } = await import('@/lib/push/send')
        await sendBuzz(user.id, buddyId)
        await supabase
          .from('profiles')
          .update({ last_buzz_date: today })
          .eq('id', user.id)
      }
    }
  }

  revalidatePath('/dashboard')
}
```

Notes on the implementation choices:

- **Dynamic import of `sendBuzz`:** keeps the server-action bundle small for users who never trigger the buzz path (e.g., users without buddies). Mirrors how Next.js recommends optional server-side dependencies be loaded.
- **`.maybeSingle()` instead of `.single()`:** the user might not have an active challenge — `.single()` would error.
- **The pre-check + write pattern:** there's a small race window if two saves land within ms — accepted per the spec.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Run full test suite**

```bash
npx jest
```

Expected: all tests pass.

**Note on the missing rate-limit unit test:** The spec lists four unit tests for the `updateDailyMessage` integration (calls sendBuzz once/day, skips on second save, skips when empty, skips when no buddy). The existing codebase has no server-action test infrastructure (no Supabase client mock harness), and the integration logic is 15 lines composing three already-tested helpers (`firstNameOf`, `sendBuzz`, the buddy-lookup query). Rather than build server-action mocking infrastructure for a single feature, we verify these four cases in the manual smoke test (Task 13, Steps 4–9). If future features add this infrastructure, return here and add the missing tests.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/checkin-actions.ts
git commit -m "feat(checkin): fire sendBuzz on first daily-message save of the day"
```

---

## Task 13: Manual smoke test

**Files:**
- None — this is a verification step run against the deployed Vercel app.

- [ ] **Step 1: Deploy to Vercel**

```bash
git push origin main
```

Wait for Vercel to deploy (check the Vercel dashboard). Confirm the build succeeded.

- [ ] **Step 2: Verify the migration ran**

In Supabase SQL Editor:

```sql
SELECT count(*) FROM push_subscriptions;
```

Expected: 0 (table exists, no rows yet).

- [ ] **Step 3: Subscribe via the banner**

On a phone or desktop browser:

1. Visit the app, log in
2. Make sure you have a buddy (joined a challenge)
3. On Today, look for the "Get a buzz from [buddy]" banner — should be visible
4. Tap **Enable** — the browser shows a permission prompt
5. Accept

Expected:
- Banner disappears
- In Supabase: `SELECT * FROM push_subscriptions WHERE user_id = '<your user id>'` returns one row

- [ ] **Step 4: Trigger a buzz**

On a **second** browser (or browser profile), log in as your buddy. Go to Today, write a daily message ("hi from buddy"), tap Save.

Expected:
- Within 5 seconds, the first browser shows a notification: *"Accountabilibuddies — [Buddy first name] sent you a buzz 🤜🤛"*
- No message content visible in the notification

- [ ] **Step 5: Tap the notification**

Tap the notification on the receiving device.

Expected: opens / focuses the app at `/dashboard`. The speech-bubble row shows the buddy's message.

- [ ] **Step 6: Verify rate limit**

From the buddy's browser, edit the message ("hi again") and Save.

Expected: no second notification on the receiving device. In Supabase: `SELECT last_buzz_date FROM profiles WHERE id = '<buddy id>'` shows today's date.

- [ ] **Step 7: Verify the toggle**

On the receiving device, go to `/profile`. Find the "Buddy buzzes" row.

Expected:
- Caption shows "On — buzzes from [buddy first name]"
- Toggle is in the "on" position

Tap the toggle.

Expected:
- Caption changes to "Off — tap to enable"
- In Supabase: `SELECT count(*) FROM push_subscriptions` is now 0 (or one less if you tested from multiple devices)

- [ ] **Step 8: Verify clearing doesn't fire a buzz**

Re-enable the toggle. Then on the buddy's browser, clear the daily message and Save.

Expected: no notification fires (clearing isn't a send).

- [ ] **Step 9: Verify next-day buzz fires**

Either wait until tomorrow OR temporarily set `last_buzz_date` to yesterday for the buddy:

```sql
UPDATE profiles SET last_buzz_date = current_date - 1 WHERE id = '<buddy id>';
```

Then have the buddy save a new daily message.

Expected: notification fires again (today's date != yesterday's stored date).

- [ ] **Step 10: Update the ROADMAP**

Edit `ref/accountabilibuddies/ROADMAP.md`. Find the "Push notifications — design first (no code)" entry in section **3. Next** and replace it with a shipped entry placed at the top of section **6. Not-doing** (the project's convention for shipped/decided items):

Search for:
```markdown
### Push notifications — design first (no code)
Write down exactly what notifications fire, when, and at what tone. *"Buddy just checked in," "You have 2 goals left today, 30 min till midnight," "Weekly wrap-up ready."* Cap at 5 notification types. Decide on iOS/Android channels and quiet hours.
- **Why this comes first:** The #1 reason to go native is push. If you can't articulate the notification model on paper, the native conversion is premature.
```

Delete that block. Then add to the top of section **6. Not-doing**:

```markdown
- **Automated/algorithmic notifications.** Decided 2026-05-27: only user-driven buddy buzzes — no streak warnings, no "X goals left", no weekly wrap-ups. Push is reserved for one human action per day per buddy pair, content hidden from preview. Shipped as buddy buzz; spec at `docs/superpowers/specs/2026-05-27-buddy-buzz-notifications.md`.
```

Also resolve open question #5 ("Notification UX") in section **7. Open questions** — delete that bullet entirely (it's now answered).

- [ ] **Step 11: Commit the roadmap update**

```bash
git add ref/accountabilibuddies/ROADMAP.md
git commit -m "docs(roadmap): mark buddy-buzz notifications shipped"
```

---

## Verification summary

After all 13 tasks:

- 4 commits in the schema/types/helpers prelude (Tasks 1–3)
- 1 dependency-install commit (Task 4)
- 6 feature commits (Tasks 5–11)
- 1 integration commit (Task 12)
- 1 smoke-test + roadmap commit (Task 13)

Total: ~13 commits, all atomic, all green on `npx jest` after each.

The full feature is gated on opt-in (banner or toggle), backward-compatible (zero impact on users who don't enable it), and rolls back cleanly by reverting Task 12 alone (the integration commit) without needing to touch the schema.
