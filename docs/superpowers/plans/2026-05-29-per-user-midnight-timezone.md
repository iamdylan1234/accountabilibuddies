# Per-User-Midnight Timezone (Part A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make challenge completion respect each buddy's real local midnight — a shared challenge completes only after the *later* of the two buddies' midnights, so neither's final day is cut short.

**Architecture:** Store each user's IANA timezone on `profiles` (auto-captured from the browser on app open). A pure `lib/challengeTime.ts` module converts "midnight on a date in a timezone" to a UTC instant (DST-correct) and computes the later-of-two-midnights completion instant. The completion cron and the dashboard both use it: the cron flips status + emails; the dashboard treats an already-over challenge as ended-on-read so Vercel Hobby's once-daily cron lag never shows a stale active challenge.

**Tech Stack:** Next.js 15 App Router, Supabase, TypeScript, `Intl.DateTimeFormat` (built-in, full-ICU Node 20), Jest.

**Spec:** `docs/superpowers/specs/2026-05-29-rematch-and-timezone-design.md` (Part A only — Part B rematch is a separate plan).

---

## File Map

**Create:**
- `lib/challengeTime.ts` — pure timezone/boundary logic: `isValidTimeZone`, `zonedMidnightUtc`, `challengeCompletionInstant`, `isChallengeOver`.
- `lib/__tests__/challengeTime.test.ts` — tests for the above (DST, null→UTC, later-of-two).
- `app/dashboard/timezone-actions.ts` — `'use server'` `updateTimezone(tz)`.
- `components/TimezoneSync.tsx` — client component; on mount, writes the browser tz to the profile if it changed.
- `docs/migrations/2026-05-29-timezone.sql` — record-of-migration artefact.

**Modify:**
- `types/database.ts` — add `timezone` to `Profile`.
- `app/layout.tsx` — select `timezone` with the existing profile fetch; mount `<TimezoneSync />`.
- `app/api/cron/monthly/route.ts` — complete via `isChallengeOver` instead of `.lt('end_date', today)`.
- `app/dashboard/page.tsx` — treat an active-but-over challenge as ended-on-read (render the completion card).

**Run once manually:**
- `ALTER TABLE profiles ADD COLUMN timezone text` in the Supabase SQL Editor (Task 1).

---

## Task 1: Schema migration

**Files:**
- Run manually: Supabase SQL Editor
- Create: `docs/migrations/2026-05-29-timezone.sql`

- [ ] **Step 1: Run the migration in Supabase**

In the SQL Editor (project → SQL Editor → new query), run:

```sql
ALTER TABLE profiles ADD COLUMN timezone text DEFAULT NULL;
```

Expected: success ("Success. No rows returned").

- [ ] **Step 2: Verify the column**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'timezone';
```

Expected: one row — `timezone | text`.

- [ ] **Step 3: Record + commit the migration artefact**

Create `docs/migrations/2026-05-29-timezone.sql`:

```sql
-- 2026-05-29 — Per-user-midnight timezone (Part A)
-- Applied to production via Supabase SQL Editor.

ALTER TABLE profiles ADD COLUMN timezone text DEFAULT NULL;  -- IANA tz, e.g. "Europe/Amsterdam"; null → UTC
```

```bash
git add docs/migrations/2026-05-29-timezone.sql
git commit -m "chore(db): record profiles.timezone migration"
```

---

## Task 2: Type update

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Add `timezone` to the `Profile` interface**

In `types/database.ts`, add the field to `Profile` immediately after `last_buzz_date`:

```ts
  last_buzz_date: string | null   // YYYY-MM-DD
  timezone: string | null         // IANA tz, e.g. "Europe/Amsterdam"; null → UTC
```

Keep all other fields unchanged.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add types/database.ts
git commit -m "feat(types): add timezone to Profile"
```

---

## Task 3: Timezone boundary helper (`lib/challengeTime.ts`)

This is the tested core. **Strict TDD.**

**Files:**
- Create: `lib/challengeTime.ts`
- Test: `lib/__tests__/challengeTime.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/challengeTime.test.ts`:

```ts
import {
  isValidTimeZone, zonedMidnightUtc, challengeCompletionInstant, isChallengeOver,
} from '../challengeTime'

describe('isValidTimeZone', () => {
  it('accepts real IANA zones', () => {
    expect(isValidTimeZone('UTC')).toBe(true)
    expect(isValidTimeZone('America/New_York')).toBe(true)
    expect(isValidTimeZone('Europe/Amsterdam')).toBe(true)
  })
  it('rejects junk and empty', () => {
    expect(isValidTimeZone('Not/AZone')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
  })
})

describe('zonedMidnightUtc', () => {
  it('UTC midnight is itself', () => {
    expect(zonedMidnightUtc('2026-06-01', 'UTC').toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })
  it('null timezone is treated as UTC', () => {
    expect(zonedMidnightUtc('2026-06-01', null).toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })
  it('America/New_York summer midnight is 04:00 UTC (EDT, UTC-4)', () => {
    expect(zonedMidnightUtc('2026-06-01', 'America/New_York').toISOString()).toBe('2026-06-01T04:00:00.000Z')
  })
  it('America/New_York winter midnight is 05:00 UTC (EST, UTC-5) — DST aware', () => {
    expect(zonedMidnightUtc('2026-01-01', 'America/New_York').toISOString()).toBe('2026-01-01T05:00:00.000Z')
  })
  it('Asia/Tokyo midnight is previous-day 15:00 UTC (UTC+9)', () => {
    expect(zonedMidnightUtc('2026-06-01', 'Asia/Tokyo').toISOString()).toBe('2026-05-31T15:00:00.000Z')
  })
})

describe('challengeCompletionInstant', () => {
  it('null/null = UTC midnight after end_date', () => {
    expect(challengeCompletionInstant('2026-05-31', null, null).toISOString())
      .toBe('2026-06-01T00:00:00.000Z')
  })
  it('takes the LATER (westmost) of the two midnights', () => {
    // Tokyo midnight Jun 1 = May 31 15:00Z; LA (PDT, UTC-7) midnight Jun 1 = Jun 1 07:00Z.
    expect(challengeCompletionInstant('2026-05-31', 'Asia/Tokyo', 'America/Los_Angeles').toISOString())
      .toBe('2026-06-01T07:00:00.000Z')
  })
  it('is order-independent', () => {
    expect(challengeCompletionInstant('2026-05-31', 'America/Los_Angeles', 'Asia/Tokyo').toISOString())
      .toBe('2026-06-01T07:00:00.000Z')
  })
})

describe('isChallengeOver', () => {
  const end = '2026-05-31'
  it('false just before the later midnight', () => {
    expect(isChallengeOver(new Date('2026-06-01T06:59:59.000Z'), end, 'Asia/Tokyo', 'America/Los_Angeles'))
      .toBe(false)
  })
  it('true at/after the later midnight', () => {
    expect(isChallengeOver(new Date('2026-06-01T07:00:00.000Z'), end, 'Asia/Tokyo', 'America/Los_Angeles'))
      .toBe(true)
  })
  it('UTC pair: over exactly at 00:00 the day after end_date', () => {
    expect(isChallengeOver(new Date('2026-06-01T00:00:00.000Z'), end, null, null)).toBe(true)
    expect(isChallengeOver(new Date('2026-05-31T23:59:59.000Z'), end, null, null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest lib/__tests__/challengeTime.test.ts`
Expected: FAIL — `Cannot find module '../challengeTime'`.

- [ ] **Step 3: Implement the helper**

Create `lib/challengeTime.ts`:

```ts
import { addDays } from '@/lib/dateUtils'

/** True if `tz` is an IANA timezone the runtime recognises. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * Offset (ms) of `timeZone` at instant `atUtc`, defined as wallClock(timeZone) − atUtc.
 * Positive east of UTC, negative west. Used to invert wall-clock → UTC.
 */
function tzOffsetMs(timeZone: string, atUtc: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p: Record<string, string> = {}
  for (const part of dtf.formatToParts(atUtc)) p[part.type] = part.value
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUtc - atUtc.getTime()
}

/**
 * The UTC instant when the wall clock in `timeZone` reads 00:00:00 on `dateStr`
 * ("YYYY-MM-DD"). DST-correct via a two-pass offset correction. `null` → UTC.
 */
export function zonedMidnightUtc(dateStr: string, timeZone: string | null): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const naiveUtc = Date.UTC(y, m - 1, d, 0, 0, 0)
  if (!timeZone) return new Date(naiveUtc)
  const o1 = tzOffsetMs(timeZone, new Date(naiveUtc))
  let result = naiveUtc - o1
  // Re-evaluate at the corrected instant in case the offset changed across a DST edge.
  const o2 = tzOffsetMs(timeZone, new Date(result))
  if (o2 !== o1) result = naiveUtc - o2
  return new Date(result)
}

/**
 * The instant a challenge with `endDate` is fully over for BOTH buddies: the LATER of
 * "00:00 on (endDate + 1 day)" in each buddy's timezone. Neither's final day is cut short.
 */
export function challengeCompletionInstant(
  endDate: string, tzCreator: string | null, tzBuddy: string | null,
): Date {
  const dayAfter = addDays(endDate, 1)
  const a = zonedMidnightUtc(dayAfter, tzCreator).getTime()
  const b = zonedMidnightUtc(dayAfter, tzBuddy).getTime()
  return new Date(Math.max(a, b))
}

/** True once `now` is at/past the challenge's completion instant (self-healing). */
export function isChallengeOver(
  now: Date, endDate: string, tzCreator: string | null, tzBuddy: string | null,
): boolean {
  return now.getTime() >= challengeCompletionInstant(endDate, tzCreator, tzBuddy).getTime()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest lib/__tests__/challengeTime.test.ts`
Expected: PASS (all describe blocks green).

If a tz test fails because the Node build lacks full ICU (very unlikely on Node 20), that's an environment problem, not a logic one — confirm `new Intl.DateTimeFormat('en', {timeZone:'Asia/Tokyo'}).format(new Date())` works in a `node -e` one-liner before changing the code.

- [ ] **Step 5: Commit**

```bash
git add lib/challengeTime.ts lib/__tests__/challengeTime.test.ts
git commit -m "feat(time): per-user-midnight challenge completion helper"
```

---

## Task 4: Timezone capture (`updateTimezone` + `TimezoneSync`)

**Files:**
- Create: `app/dashboard/timezone-actions.ts`
- Create: `components/TimezoneSync.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create the server action**

Create `app/dashboard/timezone-actions.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { isValidTimeZone } from '@/lib/challengeTime'

/**
 * Persists the caller's browser timezone. Called by <TimezoneSync /> only when the
 * browser tz differs from the stored value, so this is a no-op write at worst.
 */
export async function updateTimezone(tz: string): Promise<void> {
  if (!isValidTimeZone(tz)) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('profiles').update({ timezone: tz }).eq('id', user.id)
}
```

- [ ] **Step 2: Create the client sync component**

Create `components/TimezoneSync.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { updateTimezone } from '@/app/dashboard/timezone-actions'

/**
 * Writes the browser's current IANA timezone to the user's profile on mount, but
 * only if it differs from `currentTz` (so we don't write on every load). Renders
 * nothing. This keeps the stored tz fresh for server-side jobs (the completion
 * cron) that have no live client clock to read.
 */
export default function TimezoneSync({ currentTz }: { currentTz: string | null }) {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && tz !== currentTz) void updateTimezone(tz)
  }, [currentTz])
  return null
}
```

- [ ] **Step 3: Mount it in the root layout, fetching `timezone`**

In `app/layout.tsx`, the existing profile fetch selects `avatar_style`. Add `timezone`:

```ts
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_style, timezone')
      .eq('id', user.id)
      .single()
    avatarUrl = getAvatarUrl(user.id, profile?.avatar_style ?? 'avataaars')
```

Add the import at the top:

```ts
import TimezoneSync from '@/components/TimezoneSync'
```

And mount it next to the other `user`-gated elements (alongside `<InstallBanner />`):

```tsx
        {user && <TimezoneSync currentTz={profile?.timezone ?? null} />}
```

Note: `profile` is currently scoped inside the `if (user)` block. Lift the `timezone` value into a variable in the same scope as `avatarUrl` so it's available in the JSX — mirror how `avatarUrl` is handled:

```ts
  let avatarUrl: string | null = null
  let timezone: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_style, timezone')
      .eq('id', user.id)
      .single()
    avatarUrl = getAvatarUrl(user.id, profile?.avatar_style ?? 'avataaars')
    timezone = profile?.timezone ?? null
  }
```

Then in JSX:

```tsx
        {user && <TimezoneSync currentTz={timezone} />}
```

- [ ] **Step 4: Type-check + full suite**

Run: `npx tsc --noEmit` → zero errors.
Run: `npx jest --silent` → all pass (no new tests here; nothing should break).

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/timezone-actions.ts components/TimezoneSync.tsx app/layout.tsx
git commit -m "feat(time): capture browser timezone into profile on app open"
```

---

## Task 5: Completion cron uses per-user-midnight

**Files:**
- Modify: `app/api/cron/monthly/route.ts`

- [ ] **Step 1: Read the current query block**

The cron currently selects active challenges and filters `.lt('end_date', today)`. The select already joins `creator:profiles!creator_id(*)` and `buddy:profiles!buddy_id(*)`, so `creator.timezone` / `buddy.timezone` are available after Task 2.

- [ ] **Step 2: Replace the date filter with a tz-boundary filter**

In `app/api/cron/monthly/route.ts`, change the import line near the top to add the helper:

```ts
import { isChallengeOver } from '@/lib/challengeTime'
import type { ChallengeWithProfiles } from '@/types/database'
```

Replace the challenge fetch + filter. The current block:

```ts
  const today = new Date().toISOString().split('T')[0]

  const { data: challenges, error: challengesError } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .eq('status', 'active')
    .lt('end_date', today)
```

becomes:

```ts
  const today = new Date().toISOString().split('T')[0]
  const now = new Date()

  // Prefilter to active challenges whose end_date has reached today or passed — a
  // challenge ending in the future can't be over for anyone. Then apply the precise
  // per-user-midnight rule in JS (it needs both buddies' timezones; not expressible
  // in a single SQL predicate).
  const { data: activeChallenges, error: challengesError } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .eq('status', 'active')
    .lte('end_date', today)
```

Then, immediately after the existing `if (challengesError) { ... }` and `if (!activeChallenges) return ...` guards, filter to the ones actually over. Update those two guards to reference `activeChallenges`, then add:

```ts
  if (challengesError) {
    console.error('Failed to fetch challenges:', challengesError)
    return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 })
  }

  if (!activeChallenges) return NextResponse.json({ sent: 0, failed: 0 })

  // Keep only challenges past the LATER of the two buddies' local midnights.
  const challenges = activeChallenges.filter((c) => {
    const ch = c as unknown as ChallengeWithProfiles
    return isChallengeOver(now, ch.end_date, ch.creator?.timezone ?? null, ch.buddy?.timezone ?? null)
  })
```

The existing `for (const challenge of challenges) { ... }` loop below is unchanged and now iterates only the truly-over challenges.

- [ ] **Step 3: Type-check + full suite**

Run: `npx tsc --noEmit` → zero errors.
Run: `npx jest --silent` → all pass.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/monthly/route.ts
git commit -m "fix(cron): complete challenges at the later of both buddies' local midnights"
```

---

## Task 6: Dashboard treats an over challenge as ended-on-read

So that Hobby's once-daily cron lag never shows a stale active challenge the user could wrongly check into, the dashboard renders the completion card the moment a challenge is past its completion instant — even before the cron flips the DB status.

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Import the helper**

In `app/dashboard/page.tsx`, add to the imports:

```ts
import { isChallengeOver } from '@/lib/challengeTime'
```

- [ ] **Step 2: Extract a completion-card helper to avoid duplication**

The `!challenge` branch already builds a `CompletionCard` from a completed challenge. We now need the same card for an active-but-over challenge. Add this module-level helper near the top of `app/dashboard/page.tsx` (after the imports, before `export default`):

```ts
import { scoreChallenge } from '@/lib/scoring'   // (already imported in Task-prior state; ensure present)
import { firstNameOf } from '@/lib/profile'       // (already imported; ensure present)
import CompletionCard from '@/components/dashboard/CompletionCard'  // (already imported; ensure present)
import type { Goal, CheckIn } from '@/types/database'

function buildCompletionCard(
  challenge: ChallengeWithProfiles,
  goals: Goal[],
  myCheckIns: CheckIn[],
  buddyCheckIns: CheckIn[],
  userId: string,
  today: string,
) {
  const buddyId = challenge.creator_id === userId ? challenge.buddy_id : challenge.creator_id
  if (!buddyId) return null
  const totalDays = Math.floor(
    (new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / 86400000
  ) + 1
  const myScore = scoreChallenge(
    goals.filter(g => g.user_id === userId), myCheckIns, totalDays, challenge.start_date, today, true,
  )
  const buddyScore = scoreChallenge(
    goals.filter(g => g.user_id === buddyId), buddyCheckIns, totalDays, challenge.start_date, today, true,
  )
  const meProfile = (challenge.creator_id === userId ? challenge.creator : challenge.buddy) as Profile | null
  const buddyProfile = (challenge.creator_id === userId ? challenge.buddy : challenge.creator) as Profile | null
  const result: 'won' | 'tied' | 'lost' =
    myScore > buddyScore ? 'won' : myScore === buddyScore ? 'tied' : 'lost'
  return (
    <CompletionCard
      challengeName={challenge.month_name}
      myName={firstNameOf(meProfile)}
      buddyName={firstNameOf(buddyProfile)}
      myScore={myScore}
      buddyScore={buddyScore}
      result={result}
    />
  )
}
```

(If `Profile`, `scoreChallenge`, `firstNameOf`, `CompletionCard` are already imported from the earlier completion-card work, do not duplicate the imports — only add what's missing: `Goal`, `CheckIn`, and this `buildCompletionCard` function.)

- [ ] **Step 3: Refactor the existing `!challenge` branch to use the helper**

Replace the inline score computation in the `if (!challenge)` block with a call to `buildCompletionCard`, fetching the completed challenge's goals + check-ins:

```ts
  if (!challenge) {
    const today = new Date().toISOString().split('T')[0]

    const { data: completedRaw } = await supabase
      .from('challenge_months')
      .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
      .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
      .eq('status', 'completed')
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const completed = completedRaw as unknown as ChallengeWithProfiles | null
    let completionCard = null
    if (completed) {
      const buddyId = completed.creator_id === user.id ? completed.buddy_id : completed.creator_id
      if (buddyId) {
        const [g, mine, buddy] = await Promise.all([
          supabase.from('goals').select('*').eq('challenge_id', completed.id),
          supabase.from('check_ins').select('*').eq('user_id', user.id)
            .gte('date', completed.start_date).lte('date', completed.end_date),
          supabase.from('check_ins').select('*').eq('user_id', buddyId)
            .gte('date', completed.start_date).lte('date', completed.end_date),
        ])
        completionCard = buildCompletionCard(completed, g.data ?? [], mine.data ?? [], buddy.data ?? [], user.id, today)
      }
    }

    return (
      <div className="max-w-md mx-auto mt-12 px-6 space-y-8">
        {completionCard}
        <div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">
            {completionCard ? 'Ready for the next one?' : 'Start a challenge'}
          </h1>
          <p className="text-gray-500 mb-6">Set up a 30-day challenge and invite your buddy.</p>
          <CreateChallengeForm defaultDate={today} />
        </div>
      </div>
    )
  }
```

- [ ] **Step 4: Add the ended-on-read branch for the ACTIVE challenge**

After the existing active-challenge data fetch (the `Promise.all` that loads `goalsRes`, `myCheckInsRes`, `buddyCheckInsRes`) and before the `return <DashboardClient .../>`, insert:

```ts
  // Ended-on-read: if this active challenge is already past the per-user-midnight
  // completion instant (the daily cron may not have flipped it yet on Hobby),
  // show the completion card now instead of a stale, checkable "active" challenge.
  const over = isChallengeOver(
    new Date(),
    typedChallenge.end_date,
    typedChallenge.creator?.timezone ?? null,
    typedChallenge.buddy?.timezone ?? null,
  )
  if (over) {
    const today = new Date().toISOString().split('T')[0]
    const completionCard = buildCompletionCard(
      typedChallenge, allGoals, myCheckInsRes.data ?? [], buddyCheckInsRes.data ?? [], user.id, today,
    )
    return (
      <div className="max-w-md mx-auto mt-12 px-6 space-y-8">
        {completionCard}
        <div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Ready for the next one?</h1>
          <p className="text-gray-500 mb-6">Set up a 30-day challenge and invite your buddy.</p>
          <CreateChallengeForm defaultDate={today} />
        </div>
      </div>
    )
  }
```

`allGoals` is already computed just above the `return` in the current file; `myCheckInsRes` / `buddyCheckInsRes` are the existing fetch results. Place this block after `allGoals` is defined.

- [ ] **Step 5: Type-check + full suite**

Run: `npx tsc --noEmit` → zero errors.
Run: `npx jest --silent` → all pass.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat(dashboard): treat past-midnight active challenge as ended on read"
```

---

## Task 7: Manual verification (post-deploy)

**Files:** none.

- [ ] **Step 1: Deploy + run the migration**

Push to `main`, confirm Vercel deploy succeeds, and confirm Task 1's SQL ran (`SELECT timezone FROM profiles LIMIT 1;`).

- [ ] **Step 2: Confirm timezone capture**

Open the app logged in. In Supabase: `SELECT name, timezone FROM profiles WHERE id = '<your id>';` — `timezone` should now hold your IANA zone (e.g. `Europe/Amsterdam`).

- [ ] **Step 3: Confirm the cron still no-ops safely today**

```bash
curl -sS "https://accountabilibuddies.vercel.app/api/cron/monthly" -H "Authorization: Bearer <CRON_SECRET>"
```
Expected: `{"sent":0,"failed":0}` (nothing is past its later-midnight yet today).

- [ ] **Step 4: Confirm ended-on-read (optional, controlled)**

In Supabase, temporarily set a *test* challenge's `end_date` to yesterday, set both participants' `timezone` to `UTC`, open the dashboard → it should show the completion card (not the active dashboard). Restore the `end_date` afterward.

---

## Verification summary

After all tasks: one tested pure module (`challengeTime.ts`), tz captured on every app open, the completion cron and the dashboard both honour the later-of-two-midnights rule, and Hobby's daily-cron lag is invisible in-app via ended-on-read. Part B (rematch) builds on this — its accept-time `start_date`/`end_date` and the completion of rematch challenges reuse `challengeTime.ts` unchanged.
