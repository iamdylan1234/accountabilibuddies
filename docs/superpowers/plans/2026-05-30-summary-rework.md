# Summary Tab Visual Distinction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/wrap-up` (`ScoreSummary`) a distinct *scorecard* identity by layering four changes: 30-day heat-map, hero score + trend, status-based section grouping, warm chrome.

**Architecture:** Two pure-helper additions in `lib/heatmap.ts`, two new presentational components (`ChallengeHeatMap`, `HeroScore`), and a focused rework of `ScoreSummary` that mounts the new pieces + reorganizes sections + applies chrome. No schema changes, no new routes.

**Tech Stack:** Next.js 16 App Router (client components), React 19 (`useState`), Tailwind. Reuses existing `scoreChallenge`, `scoreGoal`, `addDays`, `daysBetween`, `formatDate`, `GoalPairGrid`, `GoalCalendarSheet`, `SummaryGoalCard`.

Spec: `docs/superpowers/specs/2026-05-30-summary-rework-design.md`

---

## File Structure

| File | Action | Why |
|---|---|---|
| `lib/heatmap.ts` | create | Pure helpers: `dailyCompletionPct`, `intensityLevel`, `weeklyTrend` |
| `lib/__tests__/heatmap.test.ts` | create | TDD coverage for the three helpers |
| `components/wrap-up/ChallengeHeatMap.tsx` | create | Calendar-aligned 30-day grid, one row per buddy |
| `components/wrap-up/HeroScore.tsx` | create | Stacked big-score cards with optional trend chip |
| `components/wrap-up/ScoreSummary.tsx` | modify | Mount new components, status-bucket sections, warm chrome |

**Task dependencies:** Task 1 → Tasks 2, 3, 4. Task 2 + Task 3 → Task 4. All → Task 5.

**Testing reality:** This repo unit-tests pure helpers in `lib/__tests__/` only — UI components are verified by `tsc + build + manual smoke`. Don't add component tests; match the codebase.

---

### Task 1: `heatmap.ts` — three pure helpers + tests (TDD)

**Files:**
- Create: `lib/heatmap.ts`
- Create: `lib/__tests__/heatmap.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/heatmap.test.ts`:

```ts
import { dailyCompletionPct, intensityLevel, weeklyTrend } from '../heatmap'
import type { Goal, CheckIn } from '@/types/database'

// Tiny factory to keep tests readable. Most fields are irrelevant to the
// helpers under test — `as Goal` casts cover the unused ones.
const goal = (id: string, type: Goal['type'], extra: Partial<Goal> = {}): Goal =>
  ({ id, type, ...extra } as Goal)
const checkIn = (goal_id: string, date: string, completed = true): CheckIn =>
  ({ goal_id, date, completed, user_id: 'u', id: `${goal_id}-${date}`, created_at: '', value: null } as CheckIn)

describe('dailyCompletionPct', () => {
  it('returns null on a rest day (no day-scheduled goals)', () => {
    const goals = [goal('g1', 'cumulative'), goal('g2', 'milestone')]
    expect(dailyCompletionPct(goals, [], '2026-06-01')).toBeNull()
  })
  it('0 when scheduled goals exist but none done', () => {
    expect(dailyCompletionPct([goal('g1', 'daily')], [], '2026-06-01')).toBe(0)
  })
  it('1 when all scheduled goals done', () => {
    expect(dailyCompletionPct([goal('g1', 'daily')], [checkIn('g1', '2026-06-01')], '2026-06-01')).toBe(1)
  })
  it('0.5 when half done', () => {
    const goals = [goal('g1', 'daily'), goal('g2', 'daily')]
    expect(dailyCompletionPct(goals, [checkIn('g1', '2026-06-01')], '2026-06-01')).toBe(0.5)
  })
  it('frequency goals only count on their schedule_dates', () => {
    const goals = [
      goal('g1', 'frequency', { schedule_dates: ['2026-06-01', '2026-06-03'] }),
      goal('g2', 'frequency', { schedule_dates: ['2026-06-02'] }),
    ]
    expect(dailyCompletionPct(goals, [checkIn('g1', '2026-06-01')], '2026-06-01')).toBe(1)
  })
  it('ignores incomplete check-ins', () => {
    expect(dailyCompletionPct(
      [goal('g1', 'daily')],
      [checkIn('g1', '2026-06-01', false)],
      '2026-06-01',
    )).toBe(0)
  })
})

describe('intensityLevel', () => {
  it('rest day (null) → -1', () => { expect(intensityLevel(null)).toBe(-1) })
  it('0 → 0', () => { expect(intensityLevel(0)).toBe(0) })
  it('just above 0 → 1', () => { expect(intensityLevel(0.01)).toBe(1) })
  it('0.25 → 1', () => { expect(intensityLevel(0.25)).toBe(1) })
  it('0.50 → 2', () => { expect(intensityLevel(0.50)).toBe(2) })
  it('0.75 → 3', () => { expect(intensityLevel(0.75)).toBe(3) })
  it('1.0 → 4', () => { expect(intensityLevel(1.0)).toBe(4) })
})

describe('weeklyTrend', () => {
  it('null when fewer than 14 days have elapsed', () => {
    const goals = [goal('g1', 'daily')]
    // Day 13 since 2026-05-01 = 2026-05-14: still < 14 days elapsed
    expect(weeklyTrend(goals, [], '2026-05-01', '2026-05-14')).toBeNull()
  })
  it('positive delta when last week beat the prior week', () => {
    const goals = [goal('g1', 'daily')]
    // Prior 7 days (2026-05-15..21): 1 check-in → low score
    // Last 7 days (2026-05-22..28): 7 check-ins → high score
    const checkIns = [
      checkIn('g1', '2026-05-15'),
      ...['22','23','24','25','26','27','28'].map(d => checkIn('g1', `2026-05-${d}`)),
    ]
    const trend = weeklyTrend(goals, checkIns, '2026-05-01', '2026-05-28')
    expect(trend).not.toBeNull()
    expect(trend!).toBeGreaterThan(0)
  })
  it('negative delta when last week was worse than the prior week', () => {
    const goals = [goal('g1', 'daily')]
    const checkIns = ['15','16','17','18','19','20','21'].map(d => checkIn('g1', `2026-05-${d}`))
    const trend = weeklyTrend(goals, checkIns, '2026-05-01', '2026-05-28')
    expect(trend).not.toBeNull()
    expect(trend!).toBeLessThan(0)
  })
})
```

- [ ] **Step 2: Run the tests, confirm they FAIL**

`cd /c/Users/Admin/accountabilibuddies && npx jest lib/__tests__/heatmap.test.ts`
Expected: failure — `dailyCompletionPct is not a function`, etc.

- [ ] **Step 3: Implement the helpers**

Create `lib/heatmap.ts`:

```ts
import type { Goal, CheckIn } from '@/types/database'
import { scoreChallenge } from '@/lib/scoring'
import { addDays, daysBetween } from '@/lib/dateUtils'

/**
 * Returns the fraction (0..1) of day-scheduled goals the user completed on
 * `date`. Day-scheduled = `daily` goals (always due) OR `frequency` goals whose
 * `schedule_dates` includes `date`. Cumulative + milestone goals are excluded —
 * they don't have a day-level "due" notion. Returns `null` if there are no
 * scheduled goals on that day (rest day).
 */
export function dailyCompletionPct(
  goals: Goal[],
  checkIns: CheckIn[],
  date: string,
): number | null {
  const dueGoals = goals.filter(g =>
    g.type === 'daily' ||
    (g.type === 'frequency' && (g.schedule_dates ?? []).includes(date))
  )
  if (dueGoals.length === 0) return null

  const done = dueGoals.filter(g =>
    checkIns.some(c => c.goal_id === g.id && c.date === date && c.completed)
  ).length

  return done / dueGoals.length
}

/**
 * Maps a daily-completion fraction to a discrete intensity level for the
 * heat-map color scale.
 *   -1: rest day (no scheduled goals)
 *    0: 0%
 *    1: 1–25%
 *    2: 26–50%
 *    3: 51–75%
 *    4: 76–100%
 */
export function intensityLevel(pct: number | null): -1 | 0 | 1 | 2 | 3 | 4 {
  if (pct === null) return -1
  if (pct === 0) return 0
  if (pct <= 0.25) return 1
  if (pct <= 0.50) return 2
  if (pct <= 0.75) return 3
  return 4
}

/**
 * Percentage-point delta between the user's score over the LAST 7 days and the
 * PRIOR 7 days. Positive = trending up; negative = down. Returns `null` if
 * fewer than 14 days have elapsed since `startDate` — comparing to <7 days of
 * prior data is too noisy to be useful. Reuses the existing `scoreChallenge`
 * algorithm with explicit 7-day windows.
 */
export function weeklyTrend(
  goals: Goal[],
  checkIns: CheckIn[],
  startDate: string,
  today: string,
): number | null {
  // Need at least 14 days of history (current 7 + prior 7).
  if (daysBetween(startDate, today) < 13) return null

  const last7Start  = addDays(today, -6)
  const prior7End   = addDays(today, -7)
  const prior7Start = addDays(today, -13)

  const inWindow = (lo: string, hi: string) =>
    checkIns.filter(c => c.date >= lo && c.date <= hi)

  const last7  = scoreChallenge(goals, inWindow(last7Start,  today),     7, last7Start,  today,     true)
  const prior7 = scoreChallenge(goals, inWindow(prior7Start, prior7End), 7, prior7Start, prior7End, true)

  return Math.round(last7 - prior7)
}
```

- [ ] **Step 4: Run the tests, confirm they PASS**

`cd /c/Users/Admin/accountabilibuddies && npx jest lib/__tests__/heatmap.test.ts`
Expected: all 16 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Admin/accountabilibuddies && git add lib/heatmap.ts lib/__tests__/heatmap.test.ts && git commit -m "feat(summary-rework): heatmap helpers (dailyCompletionPct, intensityLevel, weeklyTrend) + tests"
```

---

### Task 2: `ChallengeHeatMap` component

**Files:**
- Create: `components/wrap-up/ChallengeHeatMap.tsx`

No Jest test (matches repo convention for presentational components — the math it relies on is already covered in Task 1). Verify with tsc.

- [ ] **Step 1: Create the component**

Create `components/wrap-up/ChallengeHeatMap.tsx`:

```tsx
'use client'

import type { Goal, CheckIn } from '@/types/database'
import { formatYMD } from '@/lib/dateUtils'
import { dailyCompletionPct, intensityLevel } from '@/lib/heatmap'

interface Props {
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  myName: string
  buddyName: string
  startDate: string  // "YYYY-MM-DD"
  endDate: string
  today: string
}

/** Class for each intensity level. -2 = outside challenge window (blank). */
function cellClass(level: -2 | -1 | 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case -2: return 'bg-transparent'                              // outside window
    case -1: return 'border border-gray-300 bg-transparent'       // rest day
    case 0:  return 'bg-gray-200'
    case 1:  return 'bg-teal-200'
    case 2:  return 'bg-teal-400'
    case 3:  return 'bg-teal-600'
    case 4:  return 'bg-teal-800'
  }
}

/**
 * Compute the date list for the calendar grid: aligned to weeks (M..S),
 * spanning from the week containing `startDate` through the week containing
 * `endDate`. Returns an array of YYYY-MM-DD strings.
 */
function calendarDates(startDate: string, endDate: string): string[] {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end   = new Date(ey, em - 1, ed)

  // Back up to Monday of the start week. JS Sunday=0 → treat as 7 so Mon=1 is the first day.
  const startDow = start.getDay() === 0 ? 7 : start.getDay()
  start.setDate(start.getDate() - (startDow - 1))

  // Forward to Sunday of the end week.
  const endDow = end.getDay() === 0 ? 7 : end.getDay()
  end.setDate(end.getDate() + (7 - endDow))

  const dates: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(formatYMD(d.getFullYear(), d.getMonth(), d.getDate()))
  }
  return dates
}

function HeatRow({
  label, goals, checkIns, dates, startDate, endDate, today,
}: {
  label: string
  goals: Goal[]
  checkIns: CheckIn[]
  dates: string[]
  startDate: string
  endDate: string
  today: string
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-1.5">{label}</p>
      <div className="grid grid-cols-7 gap-1">
        {dates.map(date => {
          const inWindow = date >= startDate && date <= endDate
          const level: -2 | -1 | 0 | 1 | 2 | 3 | 4 = !inWindow
            ? -2
            : intensityLevel(dailyCompletionPct(goals, checkIns, date))
          const isToday = date === today
          const baseClass = `aspect-square rounded ${cellClass(level)}`
          const ringClass = isToday && inWindow ? 'ring-2 ring-teal-500 ring-offset-1' : ''
          return <div key={date} className={`${baseClass} ${ringClass}`} title={date} />
        })}
      </div>
    </div>
  )
}

/**
 * 30-day calendar heat-map: one row per buddy, day-of-week aligned. Each cell's
 * intensity reflects the % of that day's scheduled goals completed. Today (for
 * the active view) has a ring. Outside-challenge days are blank. Rest days
 * (0 scheduled goals) are faint outlines, distinct from 0% done.
 */
export default function ChallengeHeatMap({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myName, buddyName, startDate, endDate, today,
}: Props) {
  const dates = calendarDates(startDate, endDate)

  return (
    <section className="mb-6">
      <h2 className="w-full text-center bg-white text-gray-600 text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-full mb-2 border border-gray-200">
        Heat-map
      </h2>
      <div className="rounded-2xl bg-gray-100 p-3 space-y-3">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 gap-1 text-[10px] text-gray-400 font-semibold text-center select-none">
          <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
        </div>
        <HeatRow label={myName}    goals={myGoals}    checkIns={myCheckIns}    dates={dates} startDate={startDate} endDate={endDate} today={today} />
        <HeatRow label={buddyName} goals={buddyGoals} checkIns={buddyCheckIns} dates={dates} startDate={startDate} endDate={endDate} today={today} />
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Type-check**

`cd /c/Users/Admin/accountabilibuddies && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/Admin/accountabilibuddies && git add components/wrap-up/ChallengeHeatMap.tsx && git commit -m "feat(summary-rework): ChallengeHeatMap component (30-day calendar grid)"
```

---

### Task 3: `HeroScore` component

**Files:**
- Create: `components/wrap-up/HeroScore.tsx`

No Jest test (presentational; uses `weeklyTrend` which is already tested).

- [ ] **Step 1: Create the component**

Create `components/wrap-up/HeroScore.tsx`:

```tsx
'use client'

import type { Goal, CheckIn } from '@/types/database'
import { weeklyTrend } from '@/lib/heatmap'

interface Props {
  myName: string
  buddyName: string
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  myScore: number       // 0..100
  buddyScore: number    // 0..100
  myDaysActive: number
  buddyDaysActive: number
  totalDays: number
  startDate: string
  today: string
}

function TrendChip({ delta }: { delta: number | null }) {
  if (delta === null) return null
  const isUp = delta > 0
  const isDown = delta < 0
  const flat = !isUp && !isDown
  const color = isUp ? 'text-teal-600 bg-teal-50' : isDown ? 'text-red-500 bg-red-50' : 'text-gray-400 bg-gray-100'
  const arrow = isUp ? '↑' : isDown ? '↓' : '→'
  const sign  = delta > 0 ? '+' : ''
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${color} mt-2`}>
      <span>{arrow}</span>
      <span>{sign}{delta}{flat ? '' : '%'} vs last week</span>
    </span>
  )
}

function HeroCard({
  name, score, daysActive, totalDays, trend, isLeading,
}: {
  name: string
  score: number
  daysActive: number
  totalDays: number
  trend: number | null
  isLeading: boolean
}) {
  return (
    <div
      className={`rounded-2xl px-5 py-4 bg-white border ${isLeading ? 'border-amber-300 shadow-sm' : 'border-gray-200'}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-gray-700">{name}{isLeading && <span aria-hidden="true" className="ml-1">👑</span>}</p>
        <p className="text-xs text-gray-400 font-semibold">{daysActive}/{totalDays} days active</p>
      </div>
      <p className="text-5xl font-black text-gray-900 leading-none mt-2">{score}<span className="text-3xl text-gray-400">%</span></p>
      <TrendChip delta={trend} />
    </div>
  )
}

/**
 * Hero score cards — replaces the small ScoreTileGrid on `/wrap-up`. Two
 * vertically-stacked cards, each with a big % number, the user's days-active,
 * an optional trend chip (last-7 vs prior-7 score delta), and a subtle gold
 * border on the leading card.
 */
export default function HeroScore({
  myName, buddyName,
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myScore, buddyScore,
  myDaysActive, buddyDaysActive, totalDays,
  startDate, today,
}: Props) {
  const myTrend    = weeklyTrend(myGoals,    myCheckIns,    startDate, today)
  const buddyTrend = weeklyTrend(buddyGoals, buddyCheckIns, startDate, today)
  const myLeading    = myScore > buddyScore
  const buddyLeading = buddyScore > myScore

  return (
    <div className="space-y-3 mb-6">
      <HeroCard name={myName}    score={myScore}    daysActive={myDaysActive}    totalDays={totalDays} trend={myTrend}    isLeading={myLeading} />
      <HeroCard name={buddyName} score={buddyScore} daysActive={buddyDaysActive} totalDays={totalDays} trend={buddyTrend} isLeading={buddyLeading} />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

`cd /c/Users/Admin/accountabilibuddies && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/Admin/accountabilibuddies && git add components/wrap-up/HeroScore.tsx && git commit -m "feat(summary-rework): HeroScore component (stacked big scores + trend chip)"
```

---

### Task 4: `ScoreSummary` integration — mount new pieces, status-bucket sections, warm chrome

**Files:**
- Modify: `components/wrap-up/ScoreSummary.tsx`

The biggest single edit. Three things bundled because they all touch the same file: (a) mount `ChallengeHeatMap` + `HeroScore`, (b) replace type-based sections with status-buckets, (c) apply warm chrome.

- [ ] **Step 1: Read the current file**

Read `components/wrap-up/ScoreSummary.tsx` in full first — you'll be replacing several blocks.

- [ ] **Step 2: Add the new imports**

Alongside the existing imports:

```ts
import ChallengeHeatMap from './ChallengeHeatMap'
import HeroScore from './HeroScore'
```

Remove these imports (no longer used after the rework):
```ts
import ScoreTileGrid from '@/components/shared/ScoreTileGrid'
```
(Verify it's truly unused before deleting — search for other usages in the file first.)

- [ ] **Step 3: Add the status-bucket helper**

After the existing module-level `SummaryGoalCard` definition (and before the `Props` interface), add:

```ts
type Bucket = 'risk' | 'catching' | 'on-track'

interface BucketContext {
  totalDays: number
  startDate: string
  today: string
}

/**
 * Status bucket for a single goal at this point in the challenge.
 *
 * For daily/frequency/cumulative: bucket by `scoreGoal * 100`.
 * For milestone: complete = on-track. Incomplete uses day-elapsed % vs the
 * challenge length — late incomplete = needs attention, early incomplete =
 * still on track ("don't scare the user on Day 2").
 */
function bucketGoal(
  goal: Goal,
  checkIns: CheckIn[],
  ctx: BucketContext,
): Bucket {
  if (goal.type === 'milestone') {
    const done = checkIns.some(c => c.goal_id === goal.id && c.completed)
    if (done) return 'on-track'
    const [sy, sm, sd] = ctx.startDate.split('-').map(Number)
    const [ty, tm, td] = ctx.today.split('-').map(Number)
    const elapsed = Math.max(0,
      Math.floor((new Date(ty, tm - 1, td).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86400000) + 1
    )
    const pct = elapsed / ctx.totalDays
    if (pct > 0.8) return 'risk'
    if (pct >= 0.5) return 'catching'
    return 'on-track'
  }

  const pct = scoreGoal(goal, checkIns, ctx.totalDays, ctx.startDate, ctx.today, true)
  if (pct < 0.5) return 'risk'
  if (pct < 0.8) return 'catching'
  return 'on-track'
}

const BUCKET_META: Record<Bucket, { label: string; emoji: string }> = {
  'risk':     { label: 'Needs attention', emoji: '🔴' },
  'catching': { label: 'Catching up',     emoji: '🟡' },
  'on-track': { label: 'On track',        emoji: '🟢' },
}
```

- [ ] **Step 4: Compute bucket assignments in the component body**

Just after the existing `myMilestoneGoals` / `buddyMilestoneGoals` derivations (which can stay or be removed — they're no longer needed by the new sections), add:

```ts
const bucketCtx: BucketContext = { totalDays, startDate, today }

function partitionByBucket(goals: Goal[], checkIns: CheckIn[]): Record<Bucket, Goal[]> {
  const out: Record<Bucket, Goal[]> = { risk: [], catching: [], 'on-track': [] }
  for (const g of goals) {
    out[bucketGoal(g, checkIns, bucketCtx)].push(g)
  }
  // Sort within each bucket by score ascending (most-at-risk first).
  for (const k of ['risk', 'catching', 'on-track'] as Bucket[]) {
    out[k].sort((a, b) =>
      scoreGoal(a, checkIns, totalDays, startDate, today, true) -
      scoreGoal(b, checkIns, totalDays, startDate, today, true)
    )
  }
  return out
}

const myBuckets    = partitionByBucket(myGoals,    myCheckIns)
const buddyBuckets = partitionByBucket(buddyGoals, buddyCheckIns)
```

You can now remove the old type-grouping derivations (`myDailyGoals`, `buddyDailyGoals`, `myTargetGoals`, `buddyTargetGoals`, `myMilestoneGoals`, `buddyMilestoneGoals`) — they're unused after the section reorg.

- [ ] **Step 5: Replace the JSX section block**

Find the return statement's outermost wrapper:
```tsx
<div className="max-w-4xl mx-auto px-4 py-6">
```

Wrap the *page* with a stone-tinted background. Update the wrapper to:

```tsx
<div className="min-h-screen bg-stone-50">
  <div className="max-w-4xl mx-auto px-4 py-6">
```

(Don't forget the matching extra `</div>` at the end.)

Find the existing teal gradient header strip:
```tsx
<div
  className="rounded-2xl px-5 py-3 mb-4 text-white text-center"
  style={{ background: BRAND_GRADIENT }}
>
  <p className="font-black text-base">{challengeName}</p>
  <p className="text-white/70 text-xs font-semibold mt-0.5">
    Day {dayNumber} of {totalDays} · {isComplete ? 'Final Results' : 'Summary'}
  </p>
</div>
```

Add an amber accent bar **immediately after** this strip:
```tsx
<div className="h-[2px] bg-amber-400/70 rounded-full mb-4 -mt-3" />
```

Find the existing `<ScoreTileGrid ... />` block and **replace it** with:
```tsx
<HeroScore
  myName={myProfile?.name ?? 'Me'}
  buddyName={buddyProfile?.name ?? 'Buddy'}
  myGoals={myGoals}
  buddyGoals={buddyGoals}
  myCheckIns={myCheckIns}
  buddyCheckIns={buddyCheckIns}
  myScore={myScore}
  buddyScore={buddyScore}
  myDaysActive={myDaysActive}
  buddyDaysActive={buddyDaysActive}
  totalDays={totalDays}
  startDate={startDate}
  today={today}
/>
```

**Immediately above the HeroScore** (between the accent bar and the score), mount the heat-map:
```tsx
<ChallengeHeatMap
  myGoals={myGoals}
  buddyGoals={buddyGoals}
  myCheckIns={myCheckIns}
  buddyCheckIns={buddyCheckIns}
  myName={myProfile?.name ?? 'Me'}
  buddyName={buddyProfile?.name ?? 'Buddy'}
  startDate={startDate}
  endDate={endDate}
  today={today}
/>
```

Find the existing `<div className="space-y-6">` containing the three type-based sections (Daily / Ongoing / Milestones). **Replace its entire body** with three status-based sections:

```tsx
<div className="space-y-6">
  {(['risk', 'catching', 'on-track'] as const).map(bucket => {
    const myInBucket    = myBuckets[bucket]
    const buddyInBucket = buddyBuckets[bucket]
    if (myInBucket.length === 0 && buddyInBucket.length === 0) return null
    const meta = BUCKET_META[bucket]
    return (
      <section key={bucket}>
        <h2 className="w-full text-center bg-stone-100 text-gray-600 text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-full mb-2 border border-gray-200">
          {meta.emoji} {meta.label}
        </h2>
        <div className="rounded-2xl bg-gray-100 p-3">
          <GoalPairGrid
            myColumn={myInBucket.map(g => (
              <SummaryGoalCard
                key={g.id}
                goal={g}
                checkIns={myCheckIns}
                isOwn={true}
                totalDays={totalDays}
                startDate={startDate}
                today={today}
                pendingRequests={pendingRequests}
                isHistorical={isHistorical}
                missedDays={getMissedDays(g, myCheckIns, today, startDate, 9999)}
                onOpen={setSheet}
              />
            ))}
            buddyColumn={buddyInBucket.map(g => (
              <SummaryGoalCard
                key={g.id}
                goal={g}
                checkIns={buddyCheckIns}
                isOwn={false}
                totalDays={totalDays}
                startDate={startDate}
                today={today}
                pendingRequests={pendingRequests}
                isHistorical={isHistorical}
                missedDays={getMissedDays(g, buddyCheckIns, today, startDate, 9999)}
                onOpen={setSheet}
              />
            ))}
          />
        </div>
      </section>
    )
  })}
</div>
```

Note the section pill label now uses `bg-stone-100` (harmonizes with the warm page background) instead of `bg-white`.

- [ ] **Step 6: Type-check + build**

```
cd /c/Users/Admin/accountabilibuddies && npx tsc --noEmit && npm run build 2>&1 | tail -8
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/Admin/accountabilibuddies && git add components/wrap-up/ScoreSummary.tsx && git commit -m "feat(summary-rework): mount heat-map + hero, status-bucket sections, warm chrome"
```

---

### Task 5: Full verification + manual smoke

**Files:** none (verification only)

- [ ] **Step 1: Full automated checks**

```
cd /c/Users/Admin/accountabilibuddies
npm test                  # all suites pass, +16 new heatmap tests
npx tsc --noEmit          # clean
npm run build             # green
```

- [ ] **Step 2: Lint scoped to changed files**

```
cd /c/Users/Admin/accountabilibuddies && npx eslint \
  lib/heatmap.ts \
  lib/__tests__/heatmap.test.ts \
  components/wrap-up/ChallengeHeatMap.tsx \
  components/wrap-up/HeroScore.tsx \
  components/wrap-up/ScoreSummary.tsx
```

Expected: zero errors from these files.

- [ ] **Step 3: Manual smoke (on Vercel preview)**

1. `/wrap-up` on the active challenge → heat-map visible, today has a ring, hero score cards are prominent (big %), trend chip shown if 14+ days in, sections grouped by status (Needs attention / Catching up / On track), warm cream background, amber accent bar under header.
2. Tap a goal card → existing `GoalCalendarSheet` opens — drill-in still works.
3. Brand-new challenge (Day 1–2) → heat-map mostly empty, no trend chip, sections mostly "On track."
4. Historical view (`/wrap-up?challenge=<old-id>`) → final-state heat-map (no today ring), no trend chip, sections by final status.
5. Toggle to `/dashboard` → instantly visually distinct from `/wrap-up` (different bg, different score layout, different section labels). ✅

- [ ] **Step 4: Final commit if any fixes**

If smoke surfaces issues, commit fixes with descriptive messages.

---

## Self-Review

- **Spec coverage:**
  - Change 1 (heat-map) → Tasks 1 + 2 + integration in Task 4
  - Change 2 (hero + trend) → Tasks 1 + 3 + integration in Task 4
  - Change 3 (status buckets) → Task 4
  - Change 4 (chrome) → Task 4
  - All eight baked-in decisions (5-level scale, today ring, rest-day outlines, stacked layout, 14-day trend gate, status-only sections, warm bg, non-interactive heat-map) covered in the code blocks.
  - Out-of-scope items (cell drill-in, sparklines, animations, sharing, type-grouping toggle) explicitly not built.

- **Type consistency:** `Bucket = 'risk' | 'catching' | 'on-track'` used consistently in helper + JSX. `intensityLevel` returns `-1 | 0 | 1 | 2 | 3 | 4`; `cellClass` also handles `-2` (outside window). `weeklyTrend` returns `number | null` and `HeroScore` checks for null.

- **No placeholders:** every step has complete code.

- **Reasonable task size:** Task 4 is the largest — it bundles three concerns because they all touch the same file, and splitting would cause merge churn. Each step within Task 4 is independently reviewable in the diff.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-30-summary-rework.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task with two-stage review. Catches subtle integration issues in Task 4 in particular.

2. **Inline Execution** — execute in this session via `executing-plans`, batched with checkpoints. Faster but less independent review.

**Which approach?**
