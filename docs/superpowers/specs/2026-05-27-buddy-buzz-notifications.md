# Buddy Buzz Notifications — Design Spec

**Date:** 2026-05-27
**Status:** Approved for implementation

---

## Problem

Buddies write each other a daily message via the speech-bubble row on Today, but the recipient only sees it next time they happen to open the app. The whole point of the daily message — a small human check-in between two paired people — gets diluted by the delivery delay.

The fix is push notifications. But every habit app gets push notifications wrong by piling on algorithmic nags ("don't lose your streak!", "you have 2 goals left, 30 min till midnight"). The discipline of this feature is that there is exactly **one** notification type, fired **only** by the buddy's human action, and carrying **no preview** of the message — the recipient has to open the app to read it. No automated, app-driven notifications, ever.

## Solution

Layer a web-push notification on top of the existing `daily_message` feature. When User A saves their daily message for the day, User B (their buddy) receives one push notification with no content body — tapping it opens the dashboard where the message is visible in the speech-bubble row.

Permission is requested via a dismissable banner on the Today tab (with a permanent toggle in `/profile` as backup). Rate-limited server-side to one notification per sender per calendar day, regardless of how many times they edit/re-save.

Architecture: DIY web-push using the `web-push` npm library, VAPID keys in Vercel env, a new `push_subscriptions` table in Supabase. No third-party push SaaS, no email fallback.

---

## Behaviour

### Trigger

The notification fires inside the existing `updateDailyMessage` server action, *after* the `profiles` row is successfully updated, when ALL of the following are true:

1. The sender has a current buddy (`getCurrentBuddyId(user.id)` returns non-null)
2. The new `daily_message` is non-empty (clearing a message never fires)
3. The sender's `last_buzz_date` is null OR its `YYYY-MM-DD` portion is not the client-supplied `today` value (same timezone convention as `message_date`)

If any of the above is false, the send step is skipped silently. The daily-message UPDATE itself still succeeds regardless of the push outcome.

### What the recipient sees

- **Lock-screen / pull-down notification:**
  - Title: `Accountabilibuddies`
  - Body: `[Buddy first name] sent you a buzz 🤜🤛`
  - Icon: `/icon.png` (the fist-bump logo)
  - Badge: `/icon.png`
  - `tag: 'buddy-buzz'` — a second buzz somehow getting through replaces the first on screen instead of stacking
  - `requireInteraction: false` — auto-dismisses
- **On tap:** existing tab focused if open (and on `/dashboard`), else a new window opens to `/dashboard`. The speech-bubble row is at the top of Today, so the message is visible immediately.
- **Notification content does not include the message text.** Even if the user expands the notification, they only see the wrapper copy.

### Permission flow (recipient)

The recipient must grant `Notification.permission` for any of this to work. Two surfaces request it, sharing a single `useBuzzPermission()` hook:

**A. Banner on Today tab** (below `<InstallBanner />`):
- Visible only when ALL: buddy exists AND `Notification.permission === 'default'` AND not dismissed in `localStorage` AND the platform supports push (Android any browser, desktop Chrome/Firefox/Edge, OR iOS with `display-mode: standalone`)
- Copy: *Get a buzz when [buddy first name] sends a message* — Enable button + × dismiss
- **Enable:** runs the subscribe flow (see *Subscribe flow* below)
- **×:** writes `localStorage['accountabilibuddies-buzz-banner-dismissed-until'] = +14 days from now`, banner hides

**B. Settings toggle in `/profile`** (always rendered when the Push API is available in the browser):
- States:
  - `Notification.permission === 'default'` AND no active subscription → toggle shows "Off", tap fires permission prompt + subscribe
  - `'granted'` AND subscribed → toggle shows "On — buzzes from [buddy name]", off-switch unsubscribes
  - `'granted'` AND not subscribed → same flow as `default` (re-subscribe)
  - `'denied'` → toggle shown disabled with caption "Blocked in browser settings", small explainer
- The /profile toggle ignores the banner-dismissal localStorage flag — explicit user intent overrides.

### iOS strategy

Web Push on iOS works only when the user has installed the PWA to the home screen AND opened it from there (iOS 16.4+, Safari only — iOS Chrome/Firefox/Brave can never do push due to Apple's WebKit restriction).

- iOS Safari without standalone → the buzz banner is hidden; only the existing `<InstallBanner />` is shown
- Once they install + reopen the app from the home screen icon, the buzz banner takes its turn
- /profile toggle is hidden on iOS-non-standalone too (same support gate)
- No copy in the app announces the iOS limitation — the install banner already handles "install first" framing

### First-name extraction (shared rule)

Wherever the spec says "buddy first name", the rule is: `profile.name.split(' ')[0]` — the substring before the first space. If `profile.name` is null/empty/whitespace, fall back to `'Your buddy'`. This rule is used consistently in:

- The notification body (`sendBuzz`)
- The banner copy
- The /profile toggle caption

A single helper `firstNameOf(profile: Profile): string` should live in `lib/profile.ts` and be reused.

### Subscribe flow

1. `await navigator.serviceWorker.ready` (the Serwist SW is already registered globally)
2. `const sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })`
3. POST to `/api/push/subscribe` with `{ endpoint, p256dh, auth }` extracted from `sub`
4. Route handler authenticates via the existing Supabase cookie flow, INSERTs into `push_subscriptions` with `ON CONFLICT (endpoint) DO NOTHING` (same endpoint = same device, no duplicate row)
5. Returns 200 on success; client updates UI state to "On"

### Unsubscribe flow

1. `const sub = await registration.pushManager.getSubscription()`
2. POST to `/api/push/unsubscribe` with `{ endpoint }`
3. Route handler DELETEs the matching row
4. Client calls `sub.unsubscribe()` to revoke at the OS level
5. UI returns to "Off"

---

## Schema

### Migration

```sql
-- 1. Add rate-limit column to profiles (date, not timestamptz — uses the client's
--    local-day convention via the `today` param, matching how message_date works)
ALTER TABLE profiles ADD COLUMN last_buzz_date date DEFAULT NULL;

-- 2. New push_subscriptions table
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

### Type updates

Add to `Profile` interface in `types/database.ts`:

```ts
last_buzz_date: string | null   // YYYY-MM-DD
```

Add a new type `PushSubscription` in `types/database.ts`:

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

---

## Environment

Add to Vercel env (and `.env.local` for local dev):

```
VAPID_PUBLIC_KEY=...        # generated once via `npx web-push generate-vapid-keys`
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # same value, exposed to client
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:dylan@africancleanenergy.com
```

The keys are generated once locally and never rotated unless compromised — rotating invalidates all existing subscriptions.

---

## Server-side send logic

### `lib/push/send.ts`

```ts
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export async function sendBuzz(senderId: string, recipientId: string): Promise<void> {
  const supabase = createAdminClient()

  // Sender's first name for the notification body
  const { data: sender } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', senderId)
    .single()
  const firstName = firstNameOf(sender)   // shared helper from lib/profile.ts

  // All push subscriptions for the recipient
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', recipientId)

  if (!subs || subs.length === 0) return

  const payload = JSON.stringify({
    title: 'Accountabilibuddies',
    body: `${firstName} sent you a buzz 🤜🤛`,
  })

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
    } catch (err: any) {
      // 404 (Not Found) or 410 (Gone) = subscription expired or revoked. Delete the row.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
      // Other errors: log and swallow. Daily-message save must not be blocked.
      console.error('push send failed', { subId: sub.id, status: err?.statusCode })
    }
  }))
}
```

### Integration in `updateDailyMessage`

The existing signature is `updateDailyMessage(message: string, today: string)` — `today` is passed from the client to honour local timezone. We reuse it for the rate-limit check.

Insert this block in `app/dashboard/checkin-actions.ts` *between* the existing `profiles` UPDATE and the `revalidatePath` call:

```ts
// existing code that updates daily_message + message_date runs first

// Trigger a buzz, server-side rate-limited to 1 per sender per day
const trimmed = message.trim().slice(0, 150)
if (trimmed && !error) {
  // Pre-check the sender's last buzz day (uses the client-supplied `today` for tz consistency)
  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('last_buzz_date')
    .eq('id', user.id)
    .single()

  if (senderProfile?.last_buzz_date !== today) {
    // Find the user's current buddy — active challenge_months row joined to profiles
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
      await sendBuzz(user.id, buddyId)
      await supabase
        .from('profiles')
        .update({ last_buzz_date: today })
        .eq('id', user.id)
    }
  }
}

revalidatePath('/dashboard')
```

**Why pre-check rather than UPDATE-with-RETURNING:** Supabase JS doesn't expose `RETURNING` cleanly via the JS client, so an explicit pre-SELECT is simpler and the cost is one extra row read on save (negligible). Race-condition note: if two saves land within the same millisecond, both could read `lastSentDay !== today` and both fire. The collision window is small enough and the cost (one extra notification) is low enough that we accept it rather than add a transaction.

---

## Route handlers

### `app/api/push/subscribe/route.ts`

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { endpoint, p256dh, auth } = await req.json()
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: user.id, endpoint, p256dh, auth }, { onConflict: 'endpoint' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

### `app/api/push/unsubscribe/route.ts`

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { endpoint } = await req.json()
  if (!endpoint) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}
```

---

## Service worker

Extend the existing `app/sw.ts` (which already runs Serwist) with two new event listeners. Add **after** `serwist.addEventListeners()`:

```ts
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
      tag: 'buddy-buzz',
      requireInteraction: false,
    })
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = all.find(c => c.url.includes('/dashboard'))
    if (existing) { await existing.focus(); return }
    await self.clients.openWindow('/dashboard')
  })())
})
```

The existing `declare global { interface WorkerGlobalScope }` block in `app/sw.ts` already extends from `SerwistGlobalConfig` and needs to additionally pick up the `PushEvent` and `NotificationEvent` types. These come from `lib.webworker.d.ts`, but the current tsconfig avoids that lib to prevent conflict with `lib.dom`. The pragmatic fix is to add minimal local type aliases at the top of `sw.ts`:

```ts
type PushEvent = ExtendableEvent & { data: { json(): any; text(): string } | null }
type NotificationEvent = ExtendableEvent & { notification: Notification; action: string }
```

This keeps the existing tsconfig untouched.

---

## New components

### `lib/push/useBuzzPermission.ts` (client hook)

Single source of truth for the subscribe/unsubscribe lifecycle. Consumed by both the banner and the /profile toggle.

```ts
type BuzzPermissionState =
  | { kind: 'unsupported' }                   // no Push API in this browser
  | { kind: 'ios-needs-install' }             // iOS Safari, not standalone
  | { kind: 'default'; enable: () => Promise<void> }
  | { kind: 'granted'; subscribed: boolean; enable: () => Promise<void>; disable: () => Promise<void> }
  | { kind: 'denied' }
  | { kind: 'pending' }                       // in flight

export function useBuzzPermission(): BuzzPermissionState
```

Behaviour:
- On mount: detects platform support + reads `Notification.permission` + reads current `pushManager.getSubscription()` to determine `subscribed`
- `enable`: calls `Notification.requestPermission()`, then runs the subscribe flow above
- `disable`: runs the unsubscribe flow above

### `components/dashboard/BuzzPermissionBanner.tsx` (client)

Renders when `useBuzzPermission()` returns `kind: 'default'` AND a buddy is passed AND the banner is not dismissed:

- Container styling matches `<InstallBanner />` (rounded, brand teal accent, dismissable ×)
- Copy: *Get a buzz when {buddyFirstName} sends a message*
- Enable button → `state.enable()` (shows pending spinner)
- × button → writes `localStorage['accountabilibuddies-buzz-banner-dismissed-until']` to ISO of now+14d, banner hides
- Re-renders if state transitions to `granted` (banner self-removes)

### `components/profile/BuzzToggle.tsx` (client)

Renders inside `/profile` page. Single row with toggle on the right, status caption underneath:

| State | Label | Caption | Toggle |
|-------|-------|---------|--------|
| `unsupported` / `ios-needs-install` | (component returns null) | — | — |
| `default` | "Buddy buzzes" | "Off — tap to enable" | unchecked, tappable |
| `granted` + subscribed | "Buddy buzzes" | "On — buzzes from {buddyFirstName}" | checked, tappable |
| `granted` + not subscribed | "Buddy buzzes" | "Off — tap to enable" | unchecked, tappable |
| `denied` | "Buddy buzzes" | "Blocked in browser settings. Re-enable via your browser/OS notification settings for this site." | disabled |
| `pending` | "Buddy buzzes" | "Saving…" | disabled with spinner |

### Wiring

- `BuzzPermissionBanner` is mounted inside `DashboardClient` next to `<InstallBanner />` (the dashboard is where the message lives, so the contextual fit)
- `BuzzToggle` is mounted in the existing `/profile` page settings section
- Neither component is rendered server-side — both gate on browser-only checks

---

## Edge cases & non-features

### Edge cases (must handle)

| Case | Behaviour |
|------|-----------|
| User on 2 devices, both subscribed | All subscriptions queried; both devices get the push; `tag: 'buddy-buzz'` makes the lock-screen UX clean |
| User toggles off via /profile | Row deleted server-side AND `subscription.unsubscribe()` on device |
| Browser data cleared by user | Next push returns 404/410 → row auto-deleted; UI back to `default` state on next page load |
| Buddy pair changes mid-challenge | `getCurrentBuddyId` resolves the active pair; old subscriptions persist (still belong to user, just no buzzes go to them anymore) |
| Sender has no buddy yet | `if (buddyId)` guard skips the send |
| Sender's own permission is denied | Irrelevant — sender doesn't need permission to send, only recipient does |
| Recipient permission `default` | No row in `push_subscriptions` → `sendBuzz` is a no-op |
| Recipient permission `denied` | Same as above + UI shows "Blocked in browser settings" |
| User clears their daily message (`daily_message → null`) | `if (message)` guard skips the buzz — clearing isn't sending |
| First send ever, `last_buzz_date` is null | Fires (null !== today) — correct |
| Sender saves at local 11pm, then 11pm UTC the next day in some far timezone | `last_buzz_date` stored is the sender's local "today" not UTC, so the rate limit honours the user's day, not the server's day |
| `webpush.sendNotification` throws non-404/410 (network, 5xx) | Logged via `console.error`, swallowed. `last_buzz_date` is still updated since the action ran without throwing — accepted trade-off for code simplicity (one missed buzz/day rather than retry-storming) |
| Push payload encryption failure | Same as above (logged, swallowed, message-save not blocked) |
| User on iOS Safari, not standalone, opens banner | Banner does not render (gated on platform-support check) |

### Explicit non-goals (do NOT build)

- No notification preferences beyond on/off (no quiet hours, no per-day toggles, no per-weekday toggles)
- No "delivered" / "read" receipts shown to the sender
- No notification history view inside the app
- No "buddy is typing" or presence indicators
- No scheduled notifications, no streak reminders, no end-of-day catch-up nudges — ever
- No email fallback for users who didn't grant push permission
- No notification bundling/digesting (one save = at-most-one push, fired immediately)
- No "buzz sent ✓" toast to the sender (the sheet closes; that's the feedback)

---

## Testing

### Unit tests

- **`lib/push/send.ts`** — mock `webpush.sendNotification` and the Supabase admin client:
  - Sends to all subscriptions for the recipient
  - Deletes the subscription row on 404 response
  - Deletes the subscription row on 410 response
  - Swallows other errors without throwing
  - No-ops when recipient has zero subscriptions
- **`useBuzzPermission` hook** — mock `Notification.permission` and `navigator.serviceWorker`:
  - Returns `unsupported` when Push API unavailable
  - Returns `ios-needs-install` on iOS Safari without standalone
  - Returns `default` initially when Push API available + permission default
  - Transitions to `granted + subscribed` after `enable()` resolves
  - Transitions to `denied` if `requestPermission()` returns `denied`
- **`updateDailyMessage` rate-limit integration** — mock `sendBuzz`:
  - Calls `sendBuzz` once per calendar day
  - Skips `sendBuzz` on second save same day
  - Skips `sendBuzz` when message is empty (cleared)
  - Skips `sendBuzz` when no buddy

### Manual smoke test (pre-deploy, then post-deploy on prod)

A checklist documented in the spec:

1. Subscribe via banner → confirm row in `push_subscriptions`
2. Open second browser as the buddy → save a daily message
3. First browser receives notification within 5 seconds
4. Tap notification → first browser focuses to /dashboard
5. Save another message from buddy same day → no second notification
6. Wait until next UTC day, save again → notification fires
7. Toggle off in /profile → row deleted, no further pushes
8. Toggle on again → row recreated, pushes resume
9. (iOS only, requires real iPhone) Install to home screen, open from icon → banner appears, full flow works

### No e2e tests for push delivery itself

Actual delivery depends on the OS push service (Apple's APNs, Google's FCM, Mozilla's autopush) — can't be reproduced in CI. The manual smoke test is the verification step.

---

## Deployment notes

### Migration order

1. Run the SQL migration against Supabase (creates table + adds column)
2. Set Vercel env vars (`VAPID_*` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
3. Deploy. New SW handlers register on first page load; old clients receive the new SW within their normal Serwist update cycle (we already have `skipWaiting: true` + `clientsClaim: true`, so existing users get the new SW on next navigation)

### Backward compatibility

- Users without the new SW won't receive notifications until their SW updates — which happens automatically on next navigation. No user-facing breakage.
- Users who haven't enabled the buzz banner pre-deploy won't be affected post-deploy — the feature is opt-in.
- The `daily_message` feature itself is unchanged in behaviour (UPDATE on `profiles`); just gains a side effect.

### Rollback

If push delivery causes issues, the fastest rollback is to revert the `if (message && !error)` block inside `updateDailyMessage` — that disables the trigger without needing to drop the schema. The orphaned `push_subscriptions` rows are harmless without the send path.

---

## Open questions

None. All decisions captured in the sections above.
