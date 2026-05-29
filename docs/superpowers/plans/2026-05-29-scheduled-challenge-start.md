# Scheduled Challenge Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users sign up and set up a challenge now, but keep it a countdown (not a checkable board) until its future `start_date` (e.g. June 1).

**Architecture:** Mirror the shipped *ended-on-read* pattern. No schema change, no new status, no new cron. The DB trigger still activates a challenge when both buddies finish goals; the dashboard then *displays* a countdown until `start_date` (per the current user's timezone) instead of the live board. Goals stay editable until the challenge actually starts. A past-date guard on creation closes the footgun.

**Tech Stack:** Next.js 16 App Router (server components + server actions), React 19, Supabase, Tailwind, Jest. Reuses `lib/challengeTime.ts` (`zonedMidnightUtc`).

Spec: `docs/superpowers/specs/2026-05-29-scheduled-challenge-start-design.md`

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `lib/challengeTime.ts` | modify | Add `hasChallengeStarted(now, startDate, tz)` — symmetric with `isChallengeOver`. |
| `lib/__tests__/challengeTime.test.ts` | modify | Tests for `hasChallengeStarted`. |
| `lib/dateUtils.ts` | modify | Add pure `daysBetween(fromStr, toStr)` for the countdown. |
| `lib/__tests__/dateUtils.test.ts` | create | Tests for `daysBetween`. |
| `components/dashboard/NotStartedCard.tsx` | create | Countdown card (client component); links to `/setup`. |
| `app/dashboard/page.tsx` | modify | Add the not-started display gate to the active branch. |
| `app/setup/actions.ts` | modify | Allow goal edits until the challenge starts (not merely until active). |
| `app/setup/page.tsx` | modify | Copy fix on the goal-lock line. |
| `components/dashboard/CreateChallengeForm.tsx` | modify | `min` on the date picker (block past dates in the UI). |
| `app/dashboard/actions.ts` | modify | Server-side past-date floor in `createChallenge`. |

**Task dependencies:** Task 1 → Tasks 4 & 5. Task 2 → Task 3. Task 3 → Task 4. Tasks run in order 1→7.

**Testing reality (read before starting):** This repo unit-tests **pure helpers in `lib/__tests__/` only**. Server components, server actions, and React components are **not** Jest-tested here (consistent with the buzz/timezone/rematch work). For those tasks the verification step is `npx tsc --noEmit` + `npm run lint`, with a manual smoke test in Task 7. Do **not** invent a test harness for server actions or add React Testing Library suites — match the codebase.

---

### Task 1: `hasChallengeStarted` helper

**Files:**
- Modify: `lib/challengeTime.ts` (append after `isChallengeOver`, ~line 68)
- Test: `lib/__tests__/challengeTime.test.ts`

- [ ] **Step 1: Add the failing tests**

In `lib/__tests__/challengeTime.test.ts`, update the import on line 1–3 to include `hasChallengeStarted`:

```ts
import {
  isValidTimeZone, zonedMidnightUtc, challengeCompletionInstant, isChallengeOver, hasChallengeStarted,
} from '../challengeTime'
```

Then append this `describe` block at the end of the file:

```ts
describe('hasChallengeStarted', () => {
  it('false the minute before the local start midnight (UTC)', () => {
    expect(hasChallengeStarted(new Date('2026-05-31T23:59:00Z'), '2026-06-01', 'UTC')).toBe(false)
  })
  it('true at exactly the local start midnight (UTC)', () => {
    expect(hasChallengeStarted(new Date('2026-06-01T00:00:00Z'), '2026-06-01', 'UTC')).toBe(true)
  })
  it('true after the local start midnight (UTC)', () => {
    expect(hasChallengeStarted(new Date('2026-06-02T12:00:00Z'), '2026-06-01', 'UTC')).toBe(true)
  })
  it('null tz behaves as UTC', () => {
    expect(hasChallengeStarted(new Date('2026-05-31T23:59:00Z'), '2026-06-01', null)).toBe(false)
    expect(hasChallengeStarted(new Date('2026-06-01T00:00:00Z'), '2026-06-01', null)).toBe(true)
  })
  it('Asia/Tokyo (UTC+9): starts 15:00 UTC the previous day', () => {
    expect(hasChallengeStarted(new Date('2026-05-31T14:59:00Z'), '2026-06-01', 'Asia/Tokyo')).toBe(false)
    expect(hasChallengeStarted(new Date('2026-05-31T15:00:00Z'), '2026-06-01', 'Asia/Tokyo')).toBe(true)
  })
  it('America/New_York (EDT, UTC-4): starts 04:00 UTC', () => {
    expect(hasChallengeStarted(new Date('2026-06-01T03:59:00Z'), '2026-06-01', 'America/New_York')).toBe(false)
    expect(hasChallengeStarted(new Date('2026-06-01T04:00:00Z'), '2026-06-01', 'America/New_York')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx jest lib/__tests__/challengeTime.test.ts`
Expected: FAIL — `hasChallengeStarted is not a function` (not yet exported).

- [ ] **Step 3: Implement the helper**

Append to `lib/challengeTime.ts` (after `isChallengeOver`):

```ts
/**
 * True once `now` is at/past 00:00 on `startDate` ("YYYY-MM-DD") in `timeZone`
 * — the user's local challenge start. `null` timezone → UTC. Symmetric with
 * `isChallengeOver`; reuses the DST-correct `zonedMidnightUtc`.
 */
export function hasChallengeStarted(
  now: Date, startDate: string, timeZone: string | null,
): boolean {
  return now.getTime() >= zonedMidnightUtc(startDate, timeZone).getTime()
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx jest lib/__tests__/challengeTime.test.ts`
Expected: PASS (all `hasChallengeStarted` cases + the existing suite).

- [ ] **Step 5: Commit**

```bash
git add lib/challengeTime.ts lib/__tests__/challengeTime.test.ts
git commit -m "feat(scheduled-start): hasChallengeStarted timezone helper"
```

---

### Task 2: `daysBetween` date util

**Files:**
- Modify: `lib/dateUtils.ts` (append after `addDays`)
- Test: `lib/__tests__/dateUtils.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/dateUtils.test.ts`:

```ts
import { daysBetween } from '../dateUtils'

describe('daysBetween', () => {
  it('counts whole days forward', () => {
    expect(daysBetween('2026-05-29', '2026-06-01')).toBe(3)
  })
  it('is zero for the same day', () => {
    expect(daysBetween('2026-06-01', '2026-06-01')).toBe(0)
  })
  it('is negative when the target is in the past', () => {
    expect(daysBetween('2026-06-01', '2026-05-30')).toBe(-2)
  })
  it('crosses a month boundary', () => {
    expect(daysBetween('2026-05-31', '2026-06-02')).toBe(2)
  })
  it('crosses a spring-forward DST boundary without drift', () => {
    // US DST begins 2026-03-08 (a 23-hour local day); still exactly 2 days.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
  })
})
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx jest lib/__tests__/dateUtils.test.ts`
Expected: FAIL — `daysBetween is not a function`.

- [ ] **Step 3: Implement the util**

Append to `lib/dateUtils.ts`:

```ts
/**
 * Whole calendar days from `fromStr` to `toStr` (both "YYYY-MM-DD"), local time.
 * Positive when `toStr` is later, negative when earlier, 0 for the same day.
 * Built from local midnights and rounded, so a 23/25-hour DST day never drifts
 * the result. daysBetween('2026-05-29','2026-06-01') === 3.
 */
export function daysBetween(fromStr: string, toStr: string): number {
  const [fy, fm, fd] = fromStr.split('-').map(Number)
  const [ty, tm, td] = toStr.split('-').map(Number)
  const from = new Date(fy, fm - 1, fd).getTime()
  const to = new Date(ty, tm - 1, td).getTime()
  return Math.round((to - from) / 86400000)
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx jest lib/__tests__/dateUtils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dateUtils.ts lib/__tests__/dateUtils.test.ts
git commit -m "feat(scheduled-start): daysBetween date util for countdown"
```

---

### Task 3: `NotStartedCard` component

**Files:**
- Create: `components/dashboard/NotStartedCard.tsx`

No Jest test (matches repo convention for presentational components — the day math it relies on is already covered by `daysBetween` in Task 2). Verify with tsc in Step 2.

- [ ] **Step 1: Create the component**

Create `components/dashboard/NotStartedCard.tsx`:

```tsx
'use client'

import { BRAND_GRADIENT } from '@/lib/brand'
import { formatDate, daysBetween } from '@/lib/dateUtils'

interface Props {
  challengeId: string
  challengeName: string
  startDate: string   // "YYYY-MM-DD"
  myName: string
  buddyName: string
}

/** "June 1" from a YYYY-MM-DD string (local, no year). */
function startLine(startDate: string): string {
  const [y, m, d] = startDate.split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

/** "3 days to go" / "Starts tomorrow" / "Starts today" from days-until-start. */
function countdownLabel(days: number): string {
  if (days <= 0) return 'Starts today'
  if (days === 1) return 'Starts tomorrow'
  return `${days} days to go`
}

/**
 * Shown on Today when the user's challenge is active in the data model but its
 * start_date hasn't arrived yet (a scheduled future start, e.g. June 1). Replaces
 * the checkable board with a countdown so no check-ins happen before day 1. The
 * counter is computed from the browser's local date (same source the live board
 * uses for `today`), so it's always fresh. Goals remain editable until start —
 * hence the "Review your goals" link.
 */
export default function NotStartedCard({ challengeId, challengeName, startDate, myName, buddyName }: Props) {
  const days = daysBetween(formatDate(new Date()), startDate)

  return (
    <div className="rounded-2xl p-6 text-white text-center shadow-sm" style={{ background: BRAND_GRADIENT }}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Challenge scheduled</p>
      <h2 className="text-xl font-black mt-1">{challengeName}</h2>

      <p className="text-3xl font-black mt-4 leading-none">{countdownLabel(days)}</p>
      <p className="text-sm text-white/80 mt-2">🗓️ Starts {startLine(startDate)}</p>

      <p className="text-sm text-white/90 mt-4">{myName} &amp; {buddyName} are all set.</p>

      <a
        href={`/setup?challenge=${challengeId}`}
        className="inline-block mt-5 text-sm font-bold underline underline-offset-4 text-white/90 active:opacity-70"
      >
        Review your goals →
      </a>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/NotStartedCard.tsx
git commit -m "feat(scheduled-start): NotStartedCard countdown component"
```

---

### Task 4: Dashboard not-started display gate

**Files:**
- Modify: `app/dashboard/page.tsx`

No Jest test (server component with Supabase — not unit-tested here). Verify with tsc in Step 3.

- [ ] **Step 1: Add imports**

In `app/dashboard/page.tsx`:

- Change the `challengeTime` import (currently `import { isChallengeOver } from '@/lib/challengeTime'`) to:

```ts
import { isChallengeOver, hasChallengeStarted } from '@/lib/challengeTime'
```

- Add alongside the other component imports (near `import CompletionCard ...`):

```ts
import NotStartedCard from '@/components/dashboard/NotStartedCard'
```

(`Profile` and `firstNameOf` are already imported.)

- [ ] **Step 2: Insert the gate**

In the active-challenge section, find this block (~lines 226–233):

```ts
  const allGoals = goalsRes.data ?? []
  const myGoals = allGoals.filter(g => g.user_id === user.id)
  const buddyGoals = allGoals.filter(g => g.user_id === buddyId)

  // Ended-on-read: if this active challenge is already past the per-user-midnight
```

Insert the following **between** the `buddyGoals` line and the `// Ended-on-read:` comment:

```ts

  // Not-started-on-read: an active challenge whose start_date hasn't arrived yet
  // (in THIS user's timezone) shows a countdown instead of a checkable board, so
  // no check-ins land before day 1. Mirrors ended-on-read — no status flip. Goals
  // stay editable until start (enforced in saveGoals).
  const meProfile = (typedChallenge.creator_id === user.id ? typedChallenge.creator : typedChallenge.buddy) as Profile | null
  const buddyProfile = (typedChallenge.creator_id === user.id ? typedChallenge.buddy : typedChallenge.creator) as Profile | null
  if (!hasChallengeStarted(new Date(), typedChallenge.start_date, meProfile?.timezone ?? null)) {
    return (
      <div className="max-w-md mx-auto mt-12 px-6">
        <NotStartedCard
          challengeId={typedChallenge.id}
          challengeName={typedChallenge.month_name}
          startDate={typedChallenge.start_date}
          myName={firstNameOf(meProfile)}
          buddyName={firstNameOf(buddyProfile)}
        />
      </div>
    )
  }
```

This leaves the existing ended-on-read block and the final `<DashboardClient .../>` return untouched. Resulting order: **not-started → over → live board**.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat(scheduled-start): dashboard countdown gate before start_date"
```

---

### Task 5: Goals editable until the challenge starts

**Files:**
- Modify: `app/setup/actions.ts`
- Modify: `app/setup/page.tsx` (copy fix)

No Jest test (server action — not unit-tested here). Verify with tsc in Step 4.

- [ ] **Step 1: Add the import**

At the top of `app/setup/actions.ts`, add:

```ts
import { hasChallengeStarted } from '@/lib/challengeTime'
```

- [ ] **Step 2: Select `start_date` and relax the active lock**

Change the challenge select (currently `.select('id, status')`, ~line 31) to include `start_date`:

```ts
  const { data: challenge, error: challengeError } = await supabase
    .from('challenge_months').select('id, status, start_date')
    .eq('id', challengeId)
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .maybeSingle()
```

Replace the existing lock (lines 43–45):

```ts
  if (challenge.status === 'active') {
    return { error: 'Goals are locked once the challenge is active.' }
  }
```

with:

```ts
  // Active but not yet started (a scheduled future start): goals stay editable.
  // Only lock once the challenge has actually begun in this user's timezone.
  if (challenge.status === 'active') {
    const { data: profile } = await supabase
      .from('profiles').select('timezone').eq('id', user.id).maybeSingle()
    if (hasChallengeStarted(new Date(), challenge.start_date, profile?.timezone ?? null)) {
      return { error: 'Goals are locked once the challenge starts.' }
    }
  }
```

- [ ] **Step 3: Copy fix in the setup page**

In `app/setup/page.tsx`, change the goal-lock line (~line 71) from:

```tsx
        <p className="text-white/70 text-sm mt-1">Add 5–8 goals. You can&apos;t change these once your buddy joins.</p>
```

to:

```tsx
        <p className="text-white/70 text-sm mt-1">Add 5–8 goals. You can change these any time before the challenge starts.</p>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/setup/actions.ts app/setup/page.tsx
git commit -m "feat(scheduled-start): keep goals editable until the challenge starts"
```

---

### Task 6: Past-date guard on creation

**Files:**
- Modify: `components/dashboard/CreateChallengeForm.tsx`
- Modify: `app/dashboard/actions.ts`

No Jest test (form + server action). Verify with tsc in Step 3.

- [ ] **Step 1: Client — block past dates in the picker**

In `components/dashboard/CreateChallengeForm.tsx`, add `min={defaultDate}` to the date input (~lines 79–86):

```tsx
        <input
          name="start_date"
          type="date"
          required
          min={defaultDate}
          value={startDate}
          onChange={e => handleStartChange(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
```

- [ ] **Step 2: Server — floor in `createChallenge`**

In `app/dashboard/actions.ts`, add the import:

```ts
import { addDays } from '@/lib/dateUtils'
```

Then, immediately after the existing start-date parse/validate block (after the `isNaN(start.getTime())` check, ~line 61), add:

```ts
  // Reject a start more than a day in the past. The one-day slack absorbs
  // client/UTC timezone skew so a legitimately-"today" start is never rejected.
  const todayUtc = new Date().toISOString().split('T')[0]
  if (startDate < addDays(todayUtc, -1)) {
    return { error: "Start date can't be in the past." }
  }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/CreateChallengeForm.tsx app/dashboard/actions.ts
git commit -m "feat(scheduled-start): guard against past start dates on creation"
```

---

### Task 7: Full verification + manual smoke

**Files:** none (verification only)

- [ ] **Step 1: Full test + type + lint pass**

Run, in order:
- `npm test` → all suites pass (including the two new ones).
- `npx tsc --noEmit` → no errors.
- `npm run lint` → no new errors.

- [ ] **Step 2: Manual smoke checklist (dev server)**

Run `npm run dev` and verify:

1. **Countdown shows.** Create a challenge starting **2 days out**; have both buddies set ≥5 goals (the trigger flips it to active). The dashboard shows `NotStartedCard` ("2 days to go", "Starts <Month Day>"), **not** the live board — no check-in tiles are present.
2. **Goals editable pre-start.** From the card, click "Review your goals →", change a goal, save. It succeeds (no "locked" error) and returns to the countdown.
3. **Board goes live at start.** Set the start date to today (or fast-forward): the dashboard now renders the live board ("Day 1"), check-ins work, and re-saving goals at `/setup` now returns "Goals are locked once the challenge starts."
4. **Past-date guard.** On the create form, the date picker won't offer days before today; a past date submitted directly returns "Start date can't be in the past."

- [ ] **Step 3: Commit (only if smoke surfaced fixes)**

If Step 2 required code changes, commit them with a descriptive message. Otherwise nothing to commit.

---

## Self-Review

- **Spec coverage:** Section 1 (helper) → Task 1; Section 2 (gate) → Task 4; Section 3 (NotStartedCard) → Task 3; Section 4 (editable goals + copy) → Task 5; Section 5 (past-date guard) → Task 6; onboarding link → no code (verified in Task 7 smoke #1 implicitly via `/auth/signup`). Testing section → Tasks 1, 2, 7. All covered.
- **Type consistency:** `hasChallengeStarted(now, startDate, timeZone)` used identically in Tasks 1, 4, 5. `daysBetween(fromStr, toStr)` defined in Task 2, used in Task 3. `NotStartedCard` props (`challengeId, challengeName, startDate, myName, buddyName`) defined in Task 3, passed identically in Task 4. `firstNameOf` / `Profile` already imported in `page.tsx`.
- **No placeholders:** every code step shows complete code.
