# Missed Goals on Today Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface missed daily/frequency goals as pink "X days late" tiles at the top of Today's Goals so users can't ignore overdue accountability.

**Architecture:** Three independent changes — (1) a new `getMissedDays` scoring function with unit tests, (2) a new `MissedGoalCard` display component, (3) wiring both into `DashboardClient` alongside a `GoalCalendarSheet` for retroactive logging.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, Jest

---

## File Map

| Action | Path |
|--------|------|
| Modify | `lib/scoring.ts` |
| Modify | `lib/__tests__/scoring.test.ts` |
| Create | `components/dashboard/MissedGoalCard.tsx` |
| Modify | `components/dashboard/DashboardClient.tsx` |

---

## Task 1: `getMissedDays` scoring function + tests

**Files:**
- Modify: `lib/scoring.ts`
- Modify: `lib/__tests__/scoring.test.ts`

- [ ] **Step 1: Write failing tests**

Open `lib/__tests__/scoring.test.ts`. Add this import at the top alongside the existing imports:

```ts
import {
  scoreGoal, scoreChallenge, getWeekStart,
  isGoalActiveToday, isGoalCatchUp, getCurrentStreak,
  getBestStreak, getMissedDays,
} from '../scoring'
```

Then append this entire `describe` block at the end of the file:

```ts
describe('getMissedDays', () => {
  // Helper: goal with no schedule_dates (daily)
  const daily = baseGoal('daily')

  // Helper: frequency goal with specific dates
  const freq = (dates: string[]): Goal => ({
    ...baseGoal('frequency'),
    schedule_dates: dates,
  })

  it('returns 0 for cumulative goals', () => {
    expect(getMissedDays(baseGoal('cumulative'), [], '2026-05-07', '2026-05-01')).toBe(0)
  })

  it('returns 0 for milestone goals', () => {
    expect(getMissedDays(baseGoal('milestone'), [], '2026-05-07', '2026-05-01')).toBe(0)
  })

  it('returns 0 when challenge started today', () => {
    expect(getMissedDays(daily, [], '2026-05-07', '2026-05-07')).toBe(0)
  })

  it('daily: counts days before today with no check-in', () => {
    // challenge started May 1, today May 5, no check-ins → 4 missed days (May 1–4)
    expect(getMissedDays(daily, [], '2026-05-05', '2026-05-01')).toBe(4)
  })

  it('daily: does not count today', () => {
    // today is not missed — it is still open
    expect(getMissedDays(daily, [ci('2026-05-01'), ci('2026-05-02'), ci('2026-05-03'), ci('2026-05-04')], '2026-05-05', '2026-05-01')).toBe(0)
  })

  it('daily: partially done reduces count', () => {
    // challenge May 1, today May 5 — May 2 done, so 3 missed (May 1, 3, 4)
    expect(getMissedDays(daily, [ci('2026-05-02')], '2026-05-05', '2026-05-01')).toBe(3)
  })

  it('daily: caps lookback at 7 days', () => {
    // challenge started Apr 1, today May 7 — only looks back to Apr 30 (7 days)
    // Apr 30 – May 6 = 7 days, all missed → 7
    expect(getMissedDays(daily, [], '2026-05-07', '2026-04-01')).toBe(7)
  })

  it('frequency: counts missed schedule_dates in window', () => {
    // dates: May 1, May 3, May 6 — today May 7, window May 1–6
    // May 1 done, May 3 missed, May 6 missed → 2
    const goal = freq(['2026-05-01', '2026-05-03', '2026-05-06', '2026-05-10'])
    expect(getMissedDays(goal, [ci('2026-05-01')], '2026-05-07', '2026-05-01')).toBe(2)
  })

  it('frequency: returns 0 when all past scheduled dates done', () => {
    const goal = freq(['2026-05-01', '2026-05-03'])
    expect(getMissedDays(goal, [ci('2026-05-01'), ci('2026-05-03')], '2026-05-07', '2026-05-01')).toBe(0)
  })

  it('frequency: ignores future schedule_dates', () => {
    const goal = freq(['2026-05-10', '2026-05-15'])
    expect(getMissedDays(goal, [], '2026-05-07', '2026-05-01')).toBe(0)
  })

  it('frequency: no schedule_dates returns 0', () => {
    expect(getMissedDays(baseGoal('frequency'), [], '2026-05-07', '2026-05-01')).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd C:/Users/Admin/accountabilibuddies && npx jest scoring --no-coverage 2>&1 | tail -20
```

Expected: failures on `getMissedDays` (not exported yet).

- [ ] **Step 3: Implement `getMissedDays` in `lib/scoring.ts`**

Append this function at the end of `lib/scoring.ts` (after `longestConsecutiveCalendarRun`):

```ts
// Number of past scheduled days (within 7-day lookback from today) that have no completed check-in.
// Returns 0 for cumulative and milestone goals — they are never "missed" in this sense.
export function getMissedDays(
  goal: Goal,
  checkIns: CheckIn[],
  today: string,
  challengeStart: string,
): number {
  if (goal.type === 'cumulative' || goal.type === 'milestone') return 0

  const [ty, tm, td] = today.split('-').map(Number)
  const yesterday = formatDate(new Date(ty, tm - 1, td - 1))

  // 7-day lookback window: the later of (challengeStart) and (today − 7 days)
  const lookbackDate = new Date(ty, tm - 1, td - 7)
  const lookbackStart = formatDate(lookbackDate) > challengeStart
    ? formatDate(lookbackDate)
    : challengeStart

  // If challenge started today, yesterday is before challengeStart
  if (yesterday < lookbackStart) return 0

  const doneSet = new Set(
    checkIns.filter(c => c.goal_id === goal.id && c.completed).map(c => c.date)
  )

  if (goal.type === 'frequency') {
    if (!goal.schedule_dates || goal.schedule_dates.length === 0) return 0
    return goal.schedule_dates.filter(
      d => d >= lookbackStart && d <= yesterday && !doneSet.has(d)
    ).length
  }

  // daily: walk every calendar day in [lookbackStart, yesterday]
  let missed = 0
  const [ls, lm, ld] = lookbackStart.split('-').map(Number)
  const cursor = new Date(ls, lm - 1, ld)
  const end = new Date(ty, tm - 1, td - 1)
  while (cursor <= end) {
    if (!doneSet.has(formatDate(cursor))) missed++
    cursor.setDate(cursor.getDate() + 1)
  }
  return missed
}
```

- [ ] **Step 4: Run tests — all must pass**

```bash
cd C:/Users/Admin/accountabilibuddies && npx jest scoring --no-coverage 2>&1 | tail -20
```

Expected: all `getMissedDays` tests pass, no regressions.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Admin/accountabilibuddies && git add lib/scoring.ts lib/__tests__/scoring.test.ts && git commit -m "feat: getMissedDays scoring function with tests"
```

---

## Task 2: `MissedGoalCard` component

**Files:**
- Create: `components/dashboard/MissedGoalCard.tsx`

- [ ] **Step 1: Create the file**

Create `components/dashboard/MissedGoalCard.tsx` with this exact content:

```tsx
import type { Goal, CheckIn } from '@/types/database'

interface Props {
  goal: Goal
  missedDays: number
  isMyGoal: boolean
  onOpen: () => void
}

export default function MissedGoalCard({ goal, missedDays, isMyGoal, onOpen }: Props) {
  const label = missedDays === 1 ? '1 day late' : `${missedDays} days late`

  if (isMyGoal) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition active:scale-95 hover:opacity-90 text-red-600"
        style={{ background: '#fff1f2', border: '1.5px solid #fca5a5' }}
      >
        <span className="w-5 h-5 rounded-full border-2 border-red-300 flex-shrink-0" />
        <span className="text-sm font-semibold flex-1">{goal.title}</span>
        <span className="text-xs font-black text-red-400 flex-shrink-0">{label}</span>
      </button>
    )
  }

  return (
    <div
      className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-red-400"
      style={{ background: '#fff1f2', border: '1.5px solid #fca5a5' }}
    >
      <span className="w-5 h-5 rounded-full border-2 border-red-300 flex-shrink-0" />
      <span className="text-sm font-semibold flex-1">{goal.title}</span>
      <span className="text-xs font-black flex-shrink-0">{label}</span>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd C:/Users/Admin/accountabilibuddies && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Admin/accountabilibuddies && git add components/dashboard/MissedGoalCard.tsx && git commit -m "feat: MissedGoalCard pink tile component"
```

---

## Task 3: Wire into `DashboardClient`

**Files:**
- Modify: `components/dashboard/DashboardClient.tsx`

This task adds:
1. `getMissedDays` + `MissedGoalCard` imports
2. A `GoalCalendarSheet` sheet state (same pattern as `WeekView`)
3. Missed tile computation
4. Missed tiles prepended to Today's Goals grid
5. `GoalCalendarSheet` rendered at bottom

- [ ] **Step 1: Update imports at top of `DashboardClient.tsx`**

Replace the existing import block (lines 1–12):

```tsx
'use client'

import { useState } from 'react'
import GoalCard from './GoalCard'
import CumulativeCard from './CumulativeCard'
import MissedGoalCard from './MissedGoalCard'
import ScoreTileGrid from '@/components/shared/ScoreTileGrid'
import GoalPairGrid from '@/components/shared/GoalPairGrid'
import GoalCalendarSheet from '@/components/shared/GoalCalendarSheet'
import { useDashboardRealtime } from './useDashboardRealtime'
import { useCheckInToggle } from './useCheckInToggle'
import type { Goal, CheckIn, Reaction, ChallengeWithProfiles, Profile } from '@/types/database'
import { isGoalCatchUp, getCurrentStreak, getMissedDays } from '@/lib/scoring'
import { BRAND_GRADIENT, BRAND_GRADIENT_H } from '@/lib/brand'
import { formatDate } from '@/lib/dateUtils'
```

- [ ] **Step 2: Add `SheetTarget` type and `sheet` state**

After the `Props` interface definition (after line 24 `}`), add:

```tsx
type SheetTarget = { goal: Goal; checkIns: CheckIn[]; isOwn: boolean }
```

Inside the `DashboardClient` function body, after the line `const myFirstName = myProfile?.name?.split(' ')[0] ?? 'there'`, add:

```tsx
const [sheet, setSheet] = useState<SheetTarget | null>(null)
```

- [ ] **Step 3: Add `missedCount` helper**

After the `getReaction` function (after the closing `}` of `getReaction`), add:

```tsx
function missedCount(goal: Goal, checkIns: CheckIn[]): number {
  return getMissedDays(goal, checkIns, today, challenge.start_date)
}
```

- [ ] **Step 4: Update Today's Goals section to prepend missed tiles**

Find the Today's Goals `GoalPairGrid` in the JSX (the one with section label `Today&apos;s Goals`). Replace it entirely:

```tsx
{(myTodayGoals.length > 0 || buddyTodayGoals.length > 0 ||
  myGoals.some(g => missedCount(g, optimisticCheckIns) > 0) ||
  buddyGoals.some(g => missedCount(g, buddyCheckIns) > 0)) && (
  <div>
    <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Today&apos;s Goals</p>
    <GoalPairGrid
      myColumn={[
        ...myGoals
          .filter(g => (g.type === 'daily' || g.type === 'frequency') && missedCount(g, optimisticCheckIns) > 0)
          .map(g => (
            <MissedGoalCard
              key={`missed-${g.id}`}
              goal={g}
              missedDays={missedCount(g, optimisticCheckIns)}
              isMyGoal={true}
              onOpen={() => setSheet({ goal: g, checkIns: optimisticCheckIns, isOwn: true })}
            />
          )),
        ...myTodayGoals.map(goal => (
          <GoalCard key={goal.id} goal={goal}
            checkIn={getCheckIn(goal.id, optimisticCheckIns)} reaction={null}
            isMyGoal={true} today={today} onToggle={handleToggle}
            streak={getCurrentStreak(goal, myCheckIns, today)}
            remaining={getRemaining(goal, myCheckIns)}
            hasFailed={failedGoals.has(goal.id)} />
        )),
      ]}
      buddyColumn={[
        ...buddyGoals
          .filter(g => (g.type === 'daily' || g.type === 'frequency') && missedCount(g, buddyCheckIns) > 0)
          .map(g => (
            <MissedGoalCard
              key={`missed-${g.id}`}
              goal={g}
              missedDays={missedCount(g, buddyCheckIns)}
              isMyGoal={false}
              onOpen={() => setSheet({ goal: g, checkIns: buddyCheckIns, isOwn: false })}
            />
          )),
        ...buddyTodayGoals.map(goal => (
          <GoalCard key={goal.id} goal={goal}
            checkIn={getCheckIn(goal.id, buddyCheckIns)}
            reaction={getReaction(getCheckIn(goal.id, buddyCheckIns)?.id)}
            isMyGoal={false} today={today} onToggle={handleToggle}
            streak={getCurrentStreak(goal, buddyCheckIns, today)}
            remaining={getRemaining(goal, buddyCheckIns)} />
        )),
      ]}
    />
  </div>
)}
```

- [ ] **Step 5: Render `GoalCalendarSheet` at the bottom of the return**

Just before the final closing `</div>` of the component return, add:

```tsx
{sheet && (
  <GoalCalendarSheet
    goal={sheet.goal}
    checkIns={sheet.checkIns}
    isOwn={sheet.isOwn}
    isPending={false}
    startDate={challenge.start_date}
    endDate={challenge.end_date}
    today={today}
    challengeId={challenge.id}
    myId={myId}
    onClose={() => setSheet(null)}
  />
)}
```

- [ ] **Step 6: TypeScript check**

```bash
cd C:/Users/Admin/accountabilibuddies && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Run all tests**

```bash
cd C:/Users/Admin/accountabilibuddies && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 8: Commit and push**

```bash
cd C:/Users/Admin/accountabilibuddies && git add components/dashboard/DashboardClient.tsx && git commit -m "feat: show missed goals as pink tiles in Today's Goals section" && git push origin main
```

---

## Manual Verification

After deploying, verify:
1. A daily goal not completed yesterday → pink tile with "1 day late" appears at top of Today's Goals
2. Same goal still shows as a regular gray tile below (today's instance)
3. Tap the pink tile → GoalCalendarSheet opens, you can log the missed day
4. After logging the missed day in the calendar → pink tile disappears
5. Buddy's missed goals show as read-only pink tiles in buddy column
6. A goal with no misses → no pink tile (section looks normal)
