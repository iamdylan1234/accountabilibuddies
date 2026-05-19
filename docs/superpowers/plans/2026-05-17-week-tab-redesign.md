# Week Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition the Week tab from "Today, but for other days" to a weekly-perspective surface with a 7-day strip + day drill-down, fixing the underlying tap-to-toggle UX along the way.

**Architecture:** Decomposed into a header (week range + nav), strip (per-day dots for you + buddy), score tiles (existing component, week-to-date), and day-detail section (existing per-section grid, with new per-tile weekly-stat chips). New per-day completion classifier lives in `lib/scoring.ts` alongside existing primitives. No schema changes; uses existing `check_ins` table and `useCheckInToggle` hook.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, Supabase, Jest + @testing-library/react.

**Spec reference:** `docs/superpowers/specs/2026-05-17-week-tab-redesign-design.md`

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `components/week/WeekHeader.tsx` | Week range label (`MAY 13 - 19`) + prev/next arrows. Pure presentational. |
| `components/week/WeekStrip.tsx` | Two stacked rows of 7 day cells. Reads goal data + check-ins, renders dot states, fires `onSelectDay`. |
| `components/week/DayDetailSection.tsx` | Wraps the existing three-section grid (Daily / Ongoing / Milestones) for a selected day. Replaces the inline `renderSection` from current WeekView. |
| `components/week/WeekStrip.test.tsx` | Tests for dot state rendering and selection callback. |
| `components/week/WeekHeader.test.tsx` | Tests for date label and arrow disabled states. |

**Modified files:**

| Path | What changes |
|---|---|
| `lib/scoring.ts` | Add two helpers: `dayCompletionStatus(goal, day, checkIns, today, startDate, endDate)` and `getWeeklyStatChip(goal, weekStart, weekEnd, checkIns)`. |
| `lib/__tests__/scoring.test.ts` | Add test cases for both new helpers. |
| `components/dashboard/GoalCard.tsx` | Add optional `weeklyStat?: string` prop; new pill in priority order Failed > LATE > Weekly-stat > Remaining > Streak (cap 2). Today tab callers pass no prop and behaviour is unchanged. |
| `components/week/WeekView.tsx` | Major rewrite. Composes WeekHeader + WeekStrip + score tiles + DayDetailSection. Removes `renderSection`, inline `GoalCard`, `WeekSummaryCard`, and the prev/next-day banner. |
| `app/week/page.tsx` | Add `export const dynamic = 'force-dynamic'` at top of file. |
| `app/week/loading.tsx` | New skeleton matching the new layout (header + strip + score tiles + day-detail). |

**Files NOT touched:**

- `components/dashboard/*` — Today tab is independent. GoalCard's signature change is backwards compatible.
- Server actions / Supabase schema — uses existing `useCheckInToggle` and `check_ins` table.
- `app/dashboard/*`, `app/profile/*`, `app/wrap-up/*` — out of scope.

---

## Task 1: Add `dayCompletionStatus` helper to scoring.ts

**Files:**
- Modify: `lib/scoring.ts` (append new function)
- Modify: `lib/__tests__/scoring.test.ts` (append test block)

- [ ] **Step 1: Add failing test cases**

Open `lib/__tests__/scoring.test.ts`. At the bottom, append:

```ts
describe('dayCompletionStatus', () => {
  const dailyGoal: Goal = {
    id: 'g1', challenge_id: 'c1', user_id: 'u1', title: 'Wake up',
    type: 'daily', target_count: null, target_unit: null,
    created_at: '', schedule_dates: null, catch_up: false,
  }
  const freqGoal: Goal = {
    id: 'g2', challenge_id: 'c1', user_id: 'u1', title: 'Gym',
    type: 'frequency', target_count: 3, target_unit: null,
    created_at: '', schedule_dates: ['2026-05-12', '2026-05-14', '2026-05-16'], catch_up: false,
  }
  const goals = [dailyGoal, freqGoal]
  const start = '2026-05-12'
  const end = '2026-06-10'
  const today = '2026-05-15'

  it('returns "out-of-range" for days before challenge start', () => {
    expect(dayCompletionStatus(goals, '2026-05-10', [], today, start, end)).toBe('out-of-range')
  })

  it('returns "out-of-range" for days after challenge end', () => {
    expect(dayCompletionStatus(goals, '2026-06-15', [], today, start, end)).toBe('out-of-range')
  })

  it('returns "future" for days after today with scheduled goals', () => {
    expect(dayCompletionStatus(goals, '2026-05-16', [], today, start, end)).toBe('future')
  })

  it('returns "rest" for days with no scheduled goals (past)', () => {
    // 2026-05-13 (Wed): no frequency scheduled, but daily is always scheduled
    // → daily counts, not a rest day. Use a goal set with ONLY frequency.
    expect(dayCompletionStatus([freqGoal], '2026-05-13', [], today, start, end)).toBe('rest')
  })

  it('returns "rest" for future days with no scheduled goals', () => {
    expect(dayCompletionStatus([freqGoal], '2026-05-17', [], today, start, end)).toBe('rest')
  })

  it('returns "empty" when scheduled goals exist but none completed', () => {
    expect(dayCompletionStatus(goals, '2026-05-14', [], today, start, end)).toBe('empty')
  })

  it('returns "partial" when some but not all scheduled goals completed', () => {
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g1', user_id: 'u1', date: '2026-05-14', completed: true, value: null, created_at: '' },
    ]
    // Daily checked, frequency (g2) scheduled-not-completed → partial
    expect(dayCompletionStatus(goals, '2026-05-14', checkIns, today, start, end)).toBe('partial')
  })

  it('returns "full" when all scheduled goals completed', () => {
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g1', user_id: 'u1', date: '2026-05-14', completed: true, value: null, created_at: '' },
      { id: 'c2', goal_id: 'g2', user_id: 'u1', date: '2026-05-14', completed: true, value: null, created_at: '' },
    ]
    expect(dayCompletionStatus(goals, '2026-05-14', checkIns, today, start, end)).toBe('full')
  })

  it('ignores cumulative and milestone goals when computing status', () => {
    const milestoneGoal: Goal = { ...dailyGoal, id: 'g3', type: 'milestone' }
    const cumGoal: Goal = { ...dailyGoal, id: 'g4', type: 'cumulative', target_count: 10 }
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g1', user_id: 'u1', date: '2026-05-14', completed: true, value: null, created_at: '' },
    ]
    // Only the daily counts. Daily completed → full.
    expect(dayCompletionStatus([dailyGoal, milestoneGoal, cumGoal], '2026-05-14', checkIns, today, start, end)).toBe('full')
  })
})
```

Add the imports if not already present at the top of the file:

```ts
import { dayCompletionStatus } from '../scoring'
import type { Goal, CheckIn } from '@/types/database'
```

(`Goal` and `CheckIn` types are likely already imported; check before duplicating.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:/Users/Admin/accountabilibuddies && npx jest lib/__tests__/scoring.test.ts -t "dayCompletionStatus" 2>&1`

Expected: FAIL with `TypeError: (0 , scoring_1.dayCompletionStatus) is not a function` or similar.

- [ ] **Step 3: Implement `dayCompletionStatus`**

Open `lib/scoring.ts`. At the bottom, append:

```ts
/**
 * Per-day completion classifier for the Week-tab strip dots. Uses the SAME
 * primitives as scoreChallenge so the strip can never visually contradict
 * the score tiles.
 *
 * - "out-of-range" — day is before challenge start or after challenge end
 * - "future"       — day is after today AND has scheduled goals
 * - "rest"         — day has zero scheduled goals (intentional rest)
 * - "empty"        — has scheduled goals, today/past, none completed
 * - "partial"      — has scheduled goals, some completed, not all
 * - "full"         — has scheduled goals, all completed
 *
 * Only daily + frequency-with-this-day-scheduled goals count as "scheduled."
 * Cumulative and milestone goals are not day-specific and don't factor in.
 */
export type DayStatus = 'full' | 'partial' | 'empty' | 'rest' | 'future' | 'out-of-range'

export function dayCompletionStatus(
  goals: Goal[],
  day: string,
  checkIns: CheckIn[],
  today: string,
  challengeStart: string,
  challengeEnd: string,
): DayStatus {
  if (day < challengeStart || day > challengeEnd) return 'out-of-range'

  const scheduled = goals.filter(g =>
    g.type === 'daily' ||
    (g.type === 'frequency' && g.schedule_dates?.includes(day))
  )

  if (scheduled.length === 0) return 'rest'
  if (day > today) return 'future'

  const completedIds = new Set(
    checkIns
      .filter(c => c.date === day && c.completed)
      .map(c => c.goal_id)
  )
  const completedCount = scheduled.filter(g => completedIds.has(g.id)).length

  if (completedCount === 0) return 'empty'
  if (completedCount === scheduled.length) return 'full'
  return 'partial'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:/Users/Admin/accountabilibuddies && npx jest lib/__tests__/scoring.test.ts -t "dayCompletionStatus" 2>&1`

Expected: PASS — all 9 dayCompletionStatus tests green.

Also run the full suite to confirm no regressions: `npx jest 2>&1 | tail -6`

Expected: 4 test suites passed, all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts lib/__tests__/scoring.test.ts
git commit -m "feat(scoring): add dayCompletionStatus helper for Week-tab strip"
```

---

## Task 2: Add `getWeeklyStatChip` helper to scoring.ts

**Files:**
- Modify: `lib/scoring.ts` (append new function)
- Modify: `lib/__tests__/scoring.test.ts` (append test block)

- [ ] **Step 1: Add failing test cases**

Append to `lib/__tests__/scoring.test.ts`:

```ts
describe('getWeeklyStatChip', () => {
  const dailyGoal: Goal = {
    id: 'g1', challenge_id: 'c1', user_id: 'u1', title: 'Wake up',
    type: 'daily', target_count: null, target_unit: null,
    created_at: '', schedule_dates: null, catch_up: false,
  }
  const freqGoal: Goal = {
    id: 'g2', challenge_id: 'c1', user_id: 'u1', title: 'Gym',
    type: 'frequency', target_count: 3, target_unit: null,
    created_at: '', schedule_dates: ['2026-05-12', '2026-05-14', '2026-05-16'], catch_up: false,
  }
  const cumGoalKm: Goal = {
    id: 'g3', challenge_id: 'c1', user_id: 'u1', title: 'Run',
    type: 'cumulative', target_count: 100, target_unit: 'km',
    created_at: '', schedule_dates: null, catch_up: false,
  }
  const cumGoalNoUnit: Goal = { ...cumGoalKm, id: 'g4', target_unit: null }
  const milestoneGoal: Goal = {
    id: 'g5', challenge_id: 'c1', user_id: 'u1', title: 'Race',
    type: 'milestone', target_count: null, target_unit: null,
    created_at: '', schedule_dates: null, catch_up: false,
  }

  const weekStart = '2026-05-12'  // Monday
  const weekEnd = '2026-05-18'    // Sunday

  it('returns null for daily goals (always 7/elapsed, uninteresting)', () => {
    expect(getWeeklyStatChip(dailyGoal, weekStart, weekEnd, [])).toBeNull()
  })

  it('returns null for milestone goals (binary state visible in tile)', () => {
    expect(getWeeklyStatChip(milestoneGoal, weekStart, weekEnd, [])).toBeNull()
  })

  it('frequency: "0/3 wk" when no completions', () => {
    expect(getWeeklyStatChip(freqGoal, weekStart, weekEnd, [])).toBe('0/3 wk')
  })

  it('frequency: counts completed scheduled days in week', () => {
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g2', user_id: 'u1', date: '2026-05-12', completed: true, value: null, created_at: '' },
      { id: 'c2', goal_id: 'g2', user_id: 'u1', date: '2026-05-14', completed: true, value: null, created_at: '' },
    ]
    expect(getWeeklyStatChip(freqGoal, weekStart, weekEnd, checkIns)).toBe('2/3 wk')
  })

  it('frequency: only counts check-ins on SCHEDULED days', () => {
    // Tue (5/13) and Sun (5/18) not scheduled — these should not count
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g2', user_id: 'u1', date: '2026-05-13', completed: true, value: null, created_at: '' },
      { id: 'c2', goal_id: 'g2', user_id: 'u1', date: '2026-05-18', completed: true, value: null, created_at: '' },
    ]
    expect(getWeeklyStatChip(freqGoal, weekStart, weekEnd, checkIns)).toBe('0/3 wk')
  })

  it('cumulative with unit: "+42 km wk"', () => {
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g3', user_id: 'u1', date: '2026-05-12', completed: false, value: 12, created_at: '' },
      { id: 'c2', goal_id: 'g3', user_id: 'u1', date: '2026-05-14', completed: false, value: 30, created_at: '' },
    ]
    expect(getWeeklyStatChip(cumGoalKm, weekStart, weekEnd, checkIns)).toBe('+42 km wk')
  })

  it('cumulative with no unit: "+42 wk"', () => {
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g4', user_id: 'u1', date: '2026-05-12', completed: false, value: 42, created_at: '' },
    ]
    expect(getWeeklyStatChip(cumGoalNoUnit, weekStart, weekEnd, checkIns)).toBe('+42 wk')
  })

  it('cumulative: ignores values outside the week window', () => {
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g3', user_id: 'u1', date: '2026-05-10', completed: false, value: 100, created_at: '' },
      { id: 'c2', goal_id: 'g3', user_id: 'u1', date: '2026-05-12', completed: false, value: 5, created_at: '' },
    ]
    expect(getWeeklyStatChip(cumGoalKm, weekStart, weekEnd, checkIns)).toBe('+5 km wk')
  })

  it('cumulative: returns null when total is 0', () => {
    expect(getWeeklyStatChip(cumGoalKm, weekStart, weekEnd, [])).toBeNull()
  })
})
```

Add to imports at top:

```ts
import { getWeeklyStatChip } from '../scoring'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:/Users/Admin/accountabilibuddies && npx jest lib/__tests__/scoring.test.ts -t "getWeeklyStatChip" 2>&1`

Expected: FAIL with `TypeError: (0 , scoring_1.getWeeklyStatChip) is not a function`.

- [ ] **Step 3: Implement `getWeeklyStatChip`**

Append to `lib/scoring.ts`:

```ts
/**
 * Per-goal chip text for the Week tab tiles, preserving the per-goal weekly
 * summary that the old WeekSummaryCard surfaced. Returns null when the chip
 * would be uninformative (daily goals, milestones, cumulative with 0 total).
 */
export function getWeeklyStatChip(
  goal: Goal,
  weekStart: string,
  weekEnd: string,
  checkIns: CheckIn[],
): string | null {
  if (goal.type === 'daily' || goal.type === 'milestone') return null

  const inWindow = (d: string) => d >= weekStart && d <= weekEnd
  const own = checkIns.filter(c => c.goal_id === goal.id && inWindow(c.date))

  if (goal.type === 'frequency') {
    const scheduledThisWeek = (goal.schedule_dates ?? []).filter(inWindow)
    if (scheduledThisWeek.length === 0) return null
    const scheduledSet = new Set(scheduledThisWeek)
    const done = own.filter(c => c.completed && scheduledSet.has(c.date)).length
    return `${done}/${scheduledThisWeek.length} wk`
  }

  // cumulative
  const total = own
    .filter(c => c.value != null)
    .reduce((sum, c) => sum + (c.value ?? 0), 0)
  if (total <= 0) return null
  return goal.target_unit
    ? `+${total} ${goal.target_unit} wk`
    : `+${total} wk`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:/Users/Admin/accountabilibuddies && npx jest lib/__tests__/scoring.test.ts -t "getWeeklyStatChip" 2>&1`

Expected: PASS — all 9 getWeeklyStatChip tests green. Full suite still green: `npx jest 2>&1 | tail -6`.

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts lib/__tests__/scoring.test.ts
git commit -m "feat(scoring): add getWeeklyStatChip helper for Week-tab tile chips"
```

---

## Task 3: Create `WeekStrip.tsx` component

**Files:**
- Create: `components/week/WeekStrip.tsx`
- Create: `components/week/WeekStrip.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `components/week/WeekStrip.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import WeekStrip from './WeekStrip'
import type { Goal, CheckIn } from '@/types/database'

const dailyGoal: Goal = {
  id: 'g1', challenge_id: 'c1', user_id: 'u1', title: 'Wake up',
  type: 'daily', target_count: null, target_unit: null,
  created_at: '', schedule_dates: null, catch_up: false,
}

describe('WeekStrip', () => {
  const baseProps = {
    weekStart: '2026-05-12',  // Monday
    today: '2026-05-15',      // Thursday
    challengeStart: '2026-05-12',
    challengeEnd: '2026-06-10',
    myGoals: [dailyGoal],
    buddyGoals: [{ ...dailyGoal, id: 'g2', user_id: 'u2' }],
    myCheckIns: [] as CheckIn[],
    buddyCheckIns: [] as CheckIn[],
    myName: 'You',
    buddyName: 'Josh',
    selectedDate: '2026-05-15',
    onSelectDay: jest.fn(),
  }

  it('renders 7 day-cell groups with day labels', () => {
    render(<WeekStrip {...baseProps} />)
    expect(screen.getByText('MON')).toBeInTheDocument()
    expect(screen.getByText('SUN')).toBeInTheDocument()
  })

  it('renders name labels for both rows', () => {
    render(<WeekStrip {...baseProps} />)
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Josh')).toBeInTheDocument()
  })

  it('calls onSelectDay with the tapped date', () => {
    const onSelectDay = jest.fn()
    render(<WeekStrip {...baseProps} onSelectDay={onSelectDay} />)
    // Tap the Tuesday cell (2026-05-13)
    fireEvent.click(screen.getByRole('button', { name: /tuesday.*may 13/i }))
    expect(onSelectDay).toHaveBeenCalledWith('2026-05-13')
  })

  it('does not fire onSelectDay for out-of-range days', () => {
    const onSelectDay = jest.fn()
    render(
      <WeekStrip
        {...baseProps}
        weekStart="2026-05-05"
        challengeStart="2026-05-12"
        onSelectDay={onSelectDay}
      />
    )
    // 2026-05-05 (Monday of this week) is BEFORE challenge start, should be unclickable
    const tueButton = screen.queryByRole('button', { name: /monday.*may 5/i })
    expect(tueButton).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:/Users/Admin/accountabilibuddies && npx jest components/week/WeekStrip.test.tsx 2>&1`

Expected: FAIL — `Cannot find module './WeekStrip'`.

- [ ] **Step 3: Implement `WeekStrip.tsx`**

Create `components/week/WeekStrip.tsx`:

```tsx
'use client'

import { dayCompletionStatus, type DayStatus } from '@/lib/scoring'
import type { Goal, CheckIn } from '@/types/database'
import { formatDate } from '@/lib/dateUtils'

interface Props {
  weekStart: string         // Monday of the displayed week, "YYYY-MM-DD"
  today: string             // "YYYY-MM-DD" in local time
  challengeStart: string
  challengeEnd: string
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  myName: string
  buddyName: string
  selectedDate: string
  onSelectDay: (date: string) => void
}

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DAY_NAMES_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return formatDate(dt)
}

function dotClasses(state: DayStatus, isSelected: boolean): string {
  const base = 'w-[18px] h-[18px] rounded-full mx-auto box-border'
  const ring = isSelected ? ' outline outline-2 outline-offset-2 outline-teal-500' : ''
  const muted = state === 'out-of-range' ? ' opacity-50' : ''
  switch (state) {
    case 'full':
      return `${base} bg-teal-500${ring}${muted}`
    case 'partial':
      // half-fill via conic-gradient + border
      return `${base} border-[1.5px] border-teal-500${ring}${muted}`
    case 'empty':
      return `${base} border-[1.5px] border-gray-300${ring}${muted}`
    case 'future':
      return `${base} border-[1.5px] border-dashed border-gray-300${ring}${muted}`
    case 'rest':
    case 'out-of-range':
      // small dash centred in the cell; render with bg/style on the wrapper, dot itself is invisible
      return `${base} flex items-center justify-center${ring}${muted}`
  }
}

function Dot({ state, isSelected }: { state: DayStatus; isSelected: boolean }) {
  if (state === 'rest' || state === 'out-of-range') {
    return (
      <div className={dotClasses(state, isSelected)}>
        <div className="w-[8px] h-[2px] bg-gray-300 rounded-full" />
      </div>
    )
  }
  if (state === 'partial') {
    return (
      <div
        className={dotClasses(state, isSelected)}
        style={{ background: 'conic-gradient(#14b8a6 0% 50%, transparent 50% 100%)' }}
      />
    )
  }
  return <div className={dotClasses(state, isSelected)} />
}

function Row({
  name, goals, checkIns, weekStart, today, challengeStart, challengeEnd,
  selectedDate, onSelectDay, isSelectable,
}: {
  name: string
  goals: Goal[]
  checkIns: CheckIn[]
  weekStart: string
  today: string
  challengeStart: string
  challengeEnd: string
  selectedDate: string
  onSelectDay: (d: string) => void
  isSelectable: boolean
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[10px] font-bold text-gray-600 w-[56px] truncate">{name}</span>
      <div className="flex gap-1 flex-1">
        {DAY_LABELS.map((_, i) => {
          const date = addDays(weekStart, i)
          const state = dayCompletionStatus(goals, date, checkIns, today, challengeStart, challengeEnd)
          const isSelected = date === selectedDate
          const tappable = isSelectable && state !== 'out-of-range'
          const dayName = DAY_NAMES_LONG[i]
          const [, , dd] = date.split('-')
          const monthName = new Date(date.replace(/-/g, '/')).toLocaleDateString('en-US', { month: 'long' })
          const aria = `${dayName}, ${monthName} ${Number(dd)}`
          if (tappable) {
            return (
              <button
                key={date}
                type="button"
                aria-label={aria}
                onClick={() => onSelectDay(date)}
                className="flex-1 text-center transition active:scale-95"
              >
                <Dot state={state} isSelected={isSelected} />
              </button>
            )
          }
          return (
            <div key={date} className="flex-1 text-center" aria-label={aria}>
              <Dot state={state} isSelected={false} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function WeekStrip(props: Props) {
  return (
    <div className="bg-gray-100 rounded-2xl p-3 mb-4">
      {/* Day labels — rendered once at top */}
      <div className="flex items-center gap-2 mb-1">
        <span className="w-[56px]" />
        <div className="flex gap-1 flex-1">
          {DAY_LABELS.map(label => (
            <span key={label} className="flex-1 text-center text-[9px] font-bold text-gray-400 tracking-wider">
              {label}
            </span>
          ))}
        </div>
      </div>
      <Row
        name={props.myName}
        goals={props.myGoals}
        checkIns={props.myCheckIns}
        weekStart={props.weekStart}
        today={props.today}
        challengeStart={props.challengeStart}
        challengeEnd={props.challengeEnd}
        selectedDate={props.selectedDate}
        onSelectDay={props.onSelectDay}
        isSelectable={true}
      />
      <div className="border-t border-gray-200 my-1" />
      <Row
        name={props.buddyName}
        goals={props.buddyGoals}
        checkIns={props.buddyCheckIns}
        weekStart={props.weekStart}
        today={props.today}
        challengeStart={props.challengeStart}
        challengeEnd={props.challengeEnd}
        selectedDate={props.selectedDate}
        onSelectDay={props.onSelectDay}
        isSelectable={true}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:/Users/Admin/accountabilibuddies && npx jest components/week/WeekStrip.test.tsx 2>&1`

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add components/week/WeekStrip.tsx components/week/WeekStrip.test.tsx
git commit -m "feat(week): add WeekStrip component with per-day dot states"
```

---

## Task 4: Create `WeekHeader.tsx` component

**Files:**
- Create: `components/week/WeekHeader.tsx`
- Create: `components/week/WeekHeader.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `components/week/WeekHeader.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import WeekHeader from './WeekHeader'

describe('WeekHeader', () => {
  const baseProps = {
    weekStart: '2026-05-12',
    weekEnd: '2026-05-18',
    canGoPrev: true,
    canGoNext: true,
    onPrev: jest.fn(),
    onNext: jest.fn(),
  }

  it('renders the date range label', () => {
    render(<WeekHeader {...baseProps} />)
    expect(screen.getByText(/may 12.*–.*may 18/i)).toBeInTheDocument()
  })

  it('prev arrow is enabled when canGoPrev', () => {
    const onPrev = jest.fn()
    render(<WeekHeader {...baseProps} onPrev={onPrev} />)
    fireEvent.click(screen.getByLabelText(/previous week/i))
    expect(onPrev).toHaveBeenCalled()
  })

  it('next arrow is disabled when !canGoNext', () => {
    const onNext = jest.fn()
    render(<WeekHeader {...baseProps} canGoNext={false} onNext={onNext} />)
    const nextBtn = screen.getByLabelText(/next week/i)
    expect(nextBtn).toBeDisabled()
    fireEvent.click(nextBtn)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('prev arrow is disabled when !canGoPrev', () => {
    const onPrev = jest.fn()
    render(<WeekHeader {...baseProps} canGoPrev={false} onPrev={onPrev} />)
    const prevBtn = screen.getByLabelText(/previous week/i)
    expect(prevBtn).toBeDisabled()
    fireEvent.click(prevBtn)
    expect(onPrev).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:/Users/Admin/accountabilibuddies && npx jest components/week/WeekHeader.test.tsx 2>&1`

Expected: FAIL — `Cannot find module './WeekHeader'`.

- [ ] **Step 3: Implement `WeekHeader.tsx`**

Create `components/week/WeekHeader.tsx`:

```tsx
'use client'

interface Props {
  weekStart: string  // "YYYY-MM-DD"
  weekEnd: string    // "YYYY-MM-DD"
  canGoPrev: boolean
  canGoNext: boolean
  onPrev: () => void
  onNext: () => void
}

function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export default function WeekHeader({ weekStart, weekEnd, canGoPrev, canGoNext, onPrev, onNext }: Props) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canGoPrev}
        aria-label="Previous week"
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition active:scale-95"
      >
        ‹
      </button>
      <p className="text-xs font-bold text-gray-600 tracking-wider uppercase">
        {shortDate(weekStart)} – {shortDate(weekEnd)}
      </p>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Next week"
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition active:scale-95"
      >
        ›
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:/Users/Admin/accountabilibuddies && npx jest components/week/WeekHeader.test.tsx 2>&1`

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add components/week/WeekHeader.tsx components/week/WeekHeader.test.tsx
git commit -m "feat(week): add WeekHeader component with week range and nav arrows"
```

---

## Task 5: Create `DayDetailSection.tsx` component

**Files:**
- Create: `components/week/DayDetailSection.tsx`

This component wraps the three sub-sections (Daily Goals / Ongoing / Milestones) of the day detail. It does not have unit tests on its own — its filtering logic is trivial and its rendering is verified by integration when wired into WeekView (Task 7) and by manual visual verification in Task 10.

- [ ] **Step 1: Implement `DayDetailSection.tsx`**

Create `components/week/DayDetailSection.tsx`:

```tsx
'use client'

import type { Goal, CheckIn } from '@/types/database'
import GoalCard from '@/components/dashboard/GoalCard'
import CumulativeCard from '@/components/dashboard/CumulativeCard'
import GoalPairGrid from '@/components/shared/GoalPairGrid'
import { getWeeklyStatChip } from '@/lib/scoring'

interface Props {
  selectedDate: string      // "YYYY-MM-DD"
  weekStart: string         // "YYYY-MM-DD" — used for the weekly-stat chip window
  weekEnd: string           // "YYYY-MM-DD"
  today: string
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]     // ALL check-ins for the challenge (for weekly stat & cumulative totals)
  buddyCheckIns: CheckIn[]
  myId: string
  editable: boolean         // true only when selectedDate is today or yesterday (grace window)
  onToggle: (goalId: string, date: string) => void
}

const DAY_NAMES_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dayName = DAY_NAMES_LONG[dt.getDay()]
  const monthName = dt.toLocaleDateString('en-US', { month: 'long' })
  return `${dayName.toUpperCase()} · ${monthName.toUpperCase()} ${d}`
}

export default function DayDetailSection(props: Props) {
  const {
    selectedDate, weekStart, weekEnd, today,
    myGoals, buddyGoals, myCheckIns, buddyCheckIns,
    myId, editable, onToggle,
  } = props

  // For frequency goals, "scheduled on the selected day" means
  // schedule_dates includes selectedDate.
  const isScheduledOn = (g: Goal, day: string) =>
    g.type === 'daily' ||
    (g.type === 'frequency' && (g.schedule_dates?.includes(day) ?? false))

  const dailySection = (gs: Goal[]) => gs.filter(g => isScheduledOn(g, selectedDate))
  const ongoingSection = (gs: Goal[]) => gs.filter(g =>
    g.type === 'cumulative' ||
    (g.type === 'frequency' && !(g.schedule_dates?.includes(selectedDate) ?? false))
  )
  const milestoneSection = (gs: Goal[]) => gs.filter(g => g.type === 'milestone')

  const myDaily = dailySection(myGoals)
  const buddyDaily = dailySection(buddyGoals)
  const myOngoing = ongoingSection(myGoals)
  const buddyOngoing = ongoingSection(buddyGoals)
  const myMilestone = milestoneSection(myGoals)
  const buddyMilestone = milestoneSection(buddyGoals)

  // Per-tile renderer. Wraps GoalCard with the weekly-stat chip and the
  // tap-to-toggle-direct behavior for editable cases (selectedDate is today
  // or yesterday). Read-only otherwise.
  function renderTile(goal: Goal, ownership: 'mine' | 'buddy') {
    const checkIns = ownership === 'mine' ? myCheckIns : buddyCheckIns
    const completedOnDay = checkIns.find(c => c.goal_id === goal.id && c.date === selectedDate && c.completed)
    const checkIn = completedOnDay ?? null
    const weeklyStat = getWeeklyStatChip(goal, weekStart, weekEnd, checkIns) ?? undefined

    if (goal.type === 'cumulative') {
      // Cumulative tiles are read-only on Week tab regardless of editable
      // (logging only happens from Today via CumulativeLogSheet).
      return (
        <CumulativeCard
          key={goal.id}
          goal={goal}
          checkIns={checkIns}
          today={today}
          isMyGoal={false}
        />
      )
    }

    const isMine = ownership === 'mine'
    const tappable = isMine && editable

    return (
      <GoalCard
        key={goal.id}
        goal={goal}
        checkIn={checkIn}
        reaction={null}
        isMyGoal={tappable}
        today={today}
        onToggle={tappable ? (id) => onToggle(id, selectedDate) : () => {}}
        weeklyStat={weeklyStat}
      />
    )
  }

  function renderSection(label: string, mine: Goal[], buddy: Goal[]) {
    if (mine.length === 0 && buddy.length === 0) return null
    return (
      <section className="mb-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</h2>
        <div className="bg-gray-100 rounded-2xl p-3">
          <GoalPairGrid
            myColumn={mine.map(g => renderTile(g, 'mine'))}
            buddyColumn={buddy.map(g => renderTile(g, 'buddy'))}
          />
        </div>
      </section>
    )
  }

  const allEmpty =
    myDaily.length === 0 && buddyDaily.length === 0 &&
    myOngoing.length === 0 && buddyOngoing.length === 0 &&
    myMilestone.length === 0 && buddyMilestone.length === 0

  return (
    <div>
      <p className="text-xs font-bold text-gray-400 tracking-wider mb-3">
        {dayLabel(selectedDate)}
      </p>
      {allEmpty ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-2xl mb-1">😌</p>
          <p className="text-sm font-semibold">Rest day</p>
          <p className="text-xs mt-1">No goals scheduled.</p>
        </div>
      ) : (
        <>
          {renderSection('Daily Goals', myDaily, buddyDaily)}
          {renderSection('Ongoing', myOngoing, buddyOngoing)}
          {renderSection('Milestones', myMilestone, buddyMilestone)}
        </>
      )}
    </div>
  )
}
```

Note: this component imports `GoalCard` with a `weeklyStat` prop that doesn't exist yet — Task 6 adds that prop. TypeScript will complain until Task 6 lands. That's expected; we commit this task without compiling cleanly and Task 6 closes the loop.

- [ ] **Step 2: Confirm type error is the expected one**

Run: `cd C:/Users/Admin/accountabilibuddies && npx tsc --noEmit 2>&1 | grep -i "weeklyStat" | head -5`

Expected: TypeScript error referencing `weeklyStat` not being a valid prop on `GoalCard`. This is the intentional pending dependency on Task 6.

- [ ] **Step 3: Commit**

```bash
git add components/week/DayDetailSection.tsx
git commit -m "feat(week): add DayDetailSection composing three goal sections per day"
```

---

## Task 6: Add `weeklyStat` prop to `GoalCard.tsx` with new pill priority

**Files:**
- Modify: `components/dashboard/GoalCard.tsx`

- [ ] **Step 1: Read current GoalCard**

Run: `cd C:/Users/Admin/accountabilibuddies && cat components/dashboard/GoalCard.tsx`

Confirm the file currently has a `Props` interface with `goal, checkIn, reaction, isMyGoal, today, onToggle, streak, isCatchUp, remaining, hasFailed` and a `visiblePills` array that filters and slices to 2.

- [ ] **Step 2: Add prop + update pill array**

In `components/dashboard/GoalCard.tsx`:

1. Add `weeklyStat?: string` to the `Props` interface:

```ts
interface Props {
  goal: Goal
  checkIn: CheckIn | null
  reaction: Reaction | null
  isMyGoal: boolean
  today: string
  onToggle: (goalId: string) => void
  streak?: number
  isCatchUp?: boolean
  remaining?: number
  hasFailed?: boolean
  weeklyStat?: string
}
```

2. Destructure `weeklyStat` in the function signature:

```ts
export default function GoalCard({ goal, checkIn, reaction, isMyGoal, onToggle, streak, isCatchUp, remaining, hasFailed, weeklyStat }: Props) {
```

3. Locate the `visiblePills` array. It currently looks like:

```ts
const visiblePills = [
  showFailed && <span key="fail" className={pillClass('fail', tileState)}>Failed</span>,
  showLate && <span key="late" className={pillClass('late', tileState)}>LATE</span>,
  showRemaining && <span key="remaining" className={pillClass('remaining', tileState)}>{remaining} left</span>,
  showStreak && <span key="streak" className={pillClass('streak', tileState)}>🔥{streak}</span>,
].filter(Boolean).slice(0, 2)
```

Insert a weekly-stat pill in third position (priority Failed > LATE > Weekly-stat > Remaining > Streak):

```ts
const showWeekly = !!weeklyStat && !done
const visiblePills = [
  showFailed && <span key="fail" className={pillClass('fail', tileState)}>Failed</span>,
  showLate && <span key="late" className={pillClass('late', tileState)}>LATE</span>,
  showWeekly && <span key="weekly" className={pillClass('weekly', tileState)}>{weeklyStat}</span>,
  showRemaining && <span key="remaining" className={pillClass('remaining', tileState)}>{remaining} left</span>,
  showStreak && <span key="streak" className={pillClass('streak', tileState)}>🔥{streak}</span>,
].filter(Boolean).slice(0, 2)
```

4. Add the `'weekly'` variant to `pillClass`. Locate the `pillClass` function. It currently handles `'fail' | 'late' | 'streak' | 'remaining'`. Update the variant type and add handling:

```ts
type PillVariant = 'fail' | 'late' | 'streak' | 'remaining' | 'weekly'
```

```ts
function pillClass(variant: PillVariant, state: TileState): string {
  if (state === 'done') return `${PILL_BASE} bg-white/25 text-white`
  if (variant === 'fail' || variant === 'late') return `${PILL_BASE} bg-red-100 text-red-700`
  if (variant === 'streak') return `${PILL_BASE} bg-orange-100 text-orange-700`
  if (variant === 'weekly') return `${PILL_BASE} bg-blue-100 text-blue-700`
  // remaining
  return state === 'catchUp'
    ? `${PILL_BASE} bg-red-100 text-red-600`
    : `${PILL_BASE} bg-gray-200 text-gray-600`
}
```

Why blue for `weekly`: the brand uses teal for "done" and orange for streak; blue (sky-700/blue-700) is the unused brand-adjacent color and visually distinct from the existing pills.

- [ ] **Step 3: Run existing tests + type-check to confirm nothing breaks**

Run: `cd C:/Users/Admin/accountabilibuddies && npx tsc --noEmit 2>&1 | head -10 && npx jest 2>&1 | tail -6`

Expected: zero type errors, all existing 110+ tests pass (including the new ones from Tasks 1, 2, 3, 4). The `DayDetailSection.tsx` from Task 5 should now type-check too.

- [ ] **Step 4: Add a small test confirming the new pill renders**

Append to `lib/__tests__/scoring.test.ts` is the wrong place — the chip render is a GoalCard concern, but we have no existing GoalCard tests. Skip a render test here; the chip's behavior is fully covered by the `getWeeklyStatChip` tests (which verify the *string* the GoalCard renders), and manual visual verification in Task 10 confirms the render. This keeps the test suite focused on logic over markup.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/GoalCard.tsx
git commit -m "feat(goal-card): support weeklyStat chip with priority Failed>LATE>Weekly>Remaining>Streak"
```

---

## Task 7: Rewrite `WeekView.tsx` to compose the new components

**Files:**
- Modify: `components/week/WeekView.tsx` (major rewrite — replaces the bulk of the file)

This is the integration task. No new unit tests; correctness is verified via type-check + existing tests staying green + manual visual verification (Task 10).

- [ ] **Step 1: Read the current WeekView**

Run: `cd C:/Users/Admin/accountabilibuddies && cat components/week/WeekView.tsx`

Note the existing structure: imports, internal `WeekSummaryCard`, internal `GoalCard`, `EmptyColumn`, `WeekView` component with banner + score tiles + jump pill + sections.

- [ ] **Step 2: Replace `WeekView.tsx` contents**

Replace the entire contents of `components/week/WeekView.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { scoreChallenge, getWeekStart } from '@/lib/scoring'
import { formatDate } from '@/lib/dateUtils'
import { useCheckInToggle } from '@/components/dashboard/useCheckInToggle'
import WeekHeader from './WeekHeader'
import WeekStrip from './WeekStrip'
import DayDetailSection from './DayDetailSection'
import ScoreTileGrid from '@/components/shared/ScoreTileGrid'
import type { Goal, CheckIn, Profile } from '@/types/database'

interface Props {
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  myProfile: Profile
  buddyProfile: Profile | null
  challengeName: string
  startDate: string
  endDate: string
  totalDays: number
  challengeId: string
  myId: string
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return formatDate(dt)
}

function clampToRange(date: string, start: string, end: string): string {
  if (date < start) return start
  if (date > end) return end
  return date
}

export default function WeekView({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myProfile, buddyProfile, startDate, endDate, myId,
}: Props) {
  const now = new Date()
  const todayStr = formatDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const currentWeekStartDate = getWeekStart(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const currentWeekStart = formatDate(currentWeekStartDate)

  // Navigated week (defaults to current week)
  const [viewedWeekStart, setViewedWeekStart] = useState(currentWeekStart)
  const viewedWeekEnd = addDays(viewedWeekStart, 6)
  const isCurrentWeek = viewedWeekStart === currentWeekStart

  // Selected day within the viewed week
  const initialSelected = clampToRange(todayStr, viewedWeekStart, viewedWeekEnd)
  const [selectedDate, setSelectedDate] = useState(initialSelected)

  // Edit window: today or yesterday only (24h grace), and only in the current week.
  const yesterdayStr = addDays(todayStr, -1)
  const editable = isCurrentWeek && (selectedDate === todayStr || selectedDate === yesterdayStr)

  // Toggle handler — wired via useCheckInToggle so optimistic + persistence
  // logic stays consistent with the Today tab.
  const { optimisticCheckIns, handleToggle } = useCheckInToggle(myCheckIns, myId, todayStr)

  function handleToggleDay(goalId: string, date: string) {
    handleToggle(goalId, date)
  }

  function handlePrevWeek() {
    const prev = addDays(viewedWeekStart, -7)
    setViewedWeekStart(prev)
    // After navigating to a past week, default the selected day to that
    // week's Sunday (clamped to challenge end).
    setSelectedDate(clampToRange(addDays(prev, 6), startDate, endDate))
  }

  function handleNextWeek() {
    const next = addDays(viewedWeekStart, 7)
    setViewedWeekStart(next)
    // When navigating forward toward current week, default selection to today
    // if the new week IS the current week, otherwise to that week's Sunday.
    if (next === currentWeekStart) {
      setSelectedDate(todayStr)
    } else {
      setSelectedDate(clampToRange(addDays(next, 6), startDate, endDate))
    }
  }

  // Score tiles — week-to-date totals for the VIEWED week.
  // Upper bound is min(viewedWeekEnd, today, challenge endDate).
  // Lower bound is max(viewedWeekStart, challenge startDate).
  const scoreUpper = clampToRange(viewedWeekEnd < todayStr ? viewedWeekEnd : todayStr, startDate, endDate)
  const scoreLower = viewedWeekStart < startDate ? startDate : viewedWeekStart

  const filterToWindow = (cs: CheckIn[]) =>
    cs.filter(c => c.date >= scoreLower && c.date <= scoreUpper)

  const myScore = scoreChallenge(myGoals, filterToWindow(optimisticCheckIns), 7, scoreLower, scoreUpper)
  const buddyScore = scoreChallenge(buddyGoals, filterToWindow(buddyCheckIns), 7, scoreLower, scoreUpper)
  const iWon = myScore > buddyScore
  const tied = myScore === buddyScore
  const bothPerfect = myScore === 100 && buddyScore === 100

  // Cannot navigate to future weeks beyond the current week.
  const canGoNext = !isCurrentWeek
  // Cannot navigate before the challenge's first week.
  const challengeFirstWeek = formatDate(getWeekStart(new Date(...startDate.split('-').map((n, i) => i === 1 ? Number(n) - 1 : Number(n)) as [number, number, number])))
  const canGoPrev = viewedWeekStart > challengeFirstWeek

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <WeekHeader
        weekStart={viewedWeekStart}
        weekEnd={viewedWeekEnd}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onPrev={handlePrevWeek}
        onNext={handleNextWeek}
      />

      <WeekStrip
        weekStart={viewedWeekStart}
        today={todayStr}
        challengeStart={startDate}
        challengeEnd={endDate}
        myGoals={myGoals}
        buddyGoals={buddyGoals}
        myCheckIns={optimisticCheckIns}
        buddyCheckIns={buddyCheckIns}
        myName="You"
        buddyName={buddyProfile?.name ?? 'Buddy'}
        selectedDate={selectedDate}
        onSelectDay={setSelectedDate}
      />

      <ScoreTileGrid
        left={{
          name: myProfile?.name ?? 'Me',
          mainValue: `${myScore}%`,
          subLabel: 'week so far',
          isWinner: !tied && iWon,
        }}
        right={{
          name: buddyProfile?.name ?? 'Buddy',
          mainValue: `${buddyScore}%`,
          subLabel: 'week so far',
          isWinner: !tied && !iWon,
        }}
        tied={tied}
        bothPerfect={bothPerfect}
        selectNone
      />

      <div className="mt-4">
        <DayDetailSection
          selectedDate={selectedDate}
          weekStart={viewedWeekStart}
          weekEnd={viewedWeekEnd}
          today={todayStr}
          myGoals={myGoals}
          buddyGoals={buddyGoals}
          myCheckIns={optimisticCheckIns}
          buddyCheckIns={buddyCheckIns}
          myId={myId}
          editable={editable}
          onToggle={handleToggleDay}
        />
      </div>
    </div>
  )
}
```

Note one subtlety in the code above: the `challengeFirstWeek` line uses a parsing trick that's fragile. Replace it with a cleaner version:

```ts
const [csY, csM, csD] = startDate.split('-').map(Number)
const challengeFirstWeek = formatDate(getWeekStart(new Date(csY, csM - 1, csD)))
const canGoPrev = viewedWeekStart > challengeFirstWeek
```

- [ ] **Step 3: Type-check and run tests**

Run: `cd C:/Users/Admin/accountabilibuddies && npx tsc --noEmit 2>&1 | head -20`

Expected: zero errors.

Run: `npx jest 2>&1 | tail -6`

Expected: all tests pass (including new ones from Tasks 1-4).

- [ ] **Step 4: Run production build**

Run: `cd C:/Users/Admin/accountabilibuddies && npm run build 2>&1 | tail -10`

Expected: build completes without errors. Look for the `/week` route in the output.

- [ ] **Step 5: Commit**

```bash
git add components/week/WeekView.tsx
git commit -m "refactor(week): rewrite WeekView to compose strip + day-detail architecture"
```

---

## Task 8: Add `force-dynamic` to `app/week/page.tsx`

**Files:**
- Modify: `app/week/page.tsx`

- [ ] **Step 1: Read the current file**

Run: `cd C:/Users/Admin/accountabilibuddies && head -10 app/week/page.tsx`

Confirm the top of the file looks like:

```ts
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
...
```

There is no `export const dynamic` declaration.

- [ ] **Step 2: Add `export const dynamic = 'force-dynamic'`**

Insert a single line after the imports, before the `export default async function WeekPage`:

```ts
// Force dynamic rendering — this page depends on the authenticated user's
// data and must not be cached at the route level. Mirrors the dashboard's
// fix from commit 983b748 (PWA cache staleness on iOS Safari).
export const dynamic = 'force-dynamic'
```

- [ ] **Step 3: Verify build still works**

Run: `cd C:/Users/Admin/accountabilibuddies && npm run build 2>&1 | grep -E "/week|error" | head -5`

Expected: the `/week` route is listed with the `ƒ` (dynamic) marker, no errors.

- [ ] **Step 4: Commit**

```bash
git add app/week/page.tsx
git commit -m "fix(week): force-dynamic to prevent stale-cache bounce-back (parity with dashboard)"
```

---

## Task 9: Update `app/week/loading.tsx` skeleton

**Files:**
- Modify: `app/week/loading.tsx`

- [ ] **Step 1: Replace the skeleton with one matching the new layout**

Open `app/week/loading.tsx` and replace its contents with:

```tsx
export default function WeekLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
      {/* Week header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="w-8 h-8 rounded-full bg-gray-200" />
        <div className="h-3 w-32 bg-gray-200 rounded-full" />
        <div className="w-8 h-8 rounded-full bg-gray-200" />
      </div>

      {/* Week strip placeholder */}
      <div className="bg-gray-100 rounded-2xl p-3 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-[56px]" />
          <div className="flex gap-1 flex-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 h-3 bg-gray-200 rounded-full mx-1" />
            ))}
          </div>
        </div>
        {[0, 1].map(row => (
          <div key={row} className="flex items-center gap-2 py-1">
            <div className="w-[56px] h-3 bg-gray-200 rounded-full" />
            <div className="flex gap-1 flex-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex-1 flex justify-center">
                  <div className="w-[18px] h-[18px] rounded-full bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Score tiles */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl h-24 bg-gray-200" />
        <div className="rounded-2xl h-24 bg-gray-200" />
      </div>

      {/* Day-detail header */}
      <div className="h-3 w-40 bg-gray-200 rounded-full mb-3" />

      {/* Goal sections (one section sketch) */}
      <div className="bg-gray-100 rounded-2xl p-3">
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map(col => (
            <div key={col} className="space-y-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-xl h-16 bg-gray-200" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build still works**

Run: `cd C:/Users/Admin/accountabilibuddies && npm run build 2>&1 | tail -5`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/week/loading.tsx
git commit -m "feat(week): update loading skeleton to match new layout"
```

---

## Task 10: Manual visual verification + cleanup

No code changes in this task — verifies the redesign behaves as specified, then catches any leftover dead code from the old implementation.

- [ ] **Step 1: Run the dev server**

Run: `cd C:/Users/Admin/accountabilibuddies && npm run dev`

Open `http://localhost:3000/week` in a browser. Log in with a real account that has an active challenge.

- [ ] **Step 2: Verify each spec requirement**

Check the following against the rendered UI. Each must be true:

1. Week header shows the current week's date range (e.g. `MAY 12 – 18`) with `‹` `›` arrows.
2. The `›` arrow is disabled (you're on the current week — can't navigate forward).
3. The `‹` arrow is enabled IF the challenge has at least one prior week, disabled otherwise.
4. Below the header is the week strip with two rows (you + buddy), 7 cells each.
5. Today's column has a teal outline ring around the dot (selected state).
6. Past days in the current week show their actual completion state (full/partial/empty/rest).
7. Future days in the current week show dashed-outline dots.
8. Days outside the challenge range (if visible) show muted dashes.
9. Below the strip are two score tiles labeled "week so far" — they show your week-to-date and buddy's week-to-date scores. The "AHEAD" chip is on whoever is ahead.
10. Below the score tiles is the day-detail section, defaulting to today.
11. Goal tiles in the day-detail render with their normal styling plus a `weeklyStat` chip in the bottom-right pill row (e.g. `3/5 wk` for frequency, `+42 km wk` for cumulative, no chip for daily/milestone).
12. Tap today's column in the strip → day-detail stays on today.
13. Tap yesterday's column → day-detail updates to yesterday's data. Tapping a goal there toggles for yesterday.
14. Tap a day 2+ days ago → day-detail shows that day's data, tapping a goal does nothing (silent — no toast, no error). The press animation still fires.
15. Tap `‹` → strip + day-detail update to last week. Score tiles update to last week's "end-of-week" totals.
16. On the past week, tap any day → day-detail updates. Tapping a goal there does nothing (read-only, silent).
17. Tap `›` to return to current week → today is reselected by default.
18. No prev/next-day arrows in a banner anywhere (the old banner is gone).
19. No "↩ Today" jump pill anywhere (it's gone).
20. No WeekSummaryCard (the previous "Today view" component) renders anywhere.

If any check fails, fix the cause in the relevant file from Tasks 1-9 and re-verify.

- [ ] **Step 3: Search for dead code from the old WeekView**

Run: `cd C:/Users/Admin/accountabilibuddies && grep -rn "WeekSummaryCard\|EmptyColumn" components/week/ 2>&1`

These were internal components of the old `WeekView.tsx`. After the Task 7 rewrite they should not be referenced. If grep returns matches, delete the unused code.

Also check for the unused `DAY_NAMES` constant from the old prev/next banner:

Run: `grep -n "DAY_NAMES" components/week/WeekView.tsx 2>&1`

If present and unused, delete it.

- [ ] **Step 4: Run full test suite + production build one more time**

Run: `cd C:/Users/Admin/accountabilibuddies && npx jest 2>&1 | tail -6 && npm run build 2>&1 | tail -5`

Expected: all tests pass, build clean.

- [ ] **Step 5: Final cleanup commit (if any)**

```bash
git add components/week/WeekView.tsx
git commit -m "chore(week): remove dead code from previous WeekView implementation"
```

(Only commit if Step 3 found dead code to remove.)

---

## Done

After all ten tasks complete, the Week tab will be a week-perspective surface with day drill-down. The cumulative diff:

- 5 new files (`WeekHeader`, `WeekStrip`, `DayDetailSection` + 2 test files)
- 3 modified files (`GoalCard`, `WeekView`, `app/week/loading.tsx`)
- 2 modified scoring/test files (`scoring.ts`, `scoring.test.ts`)
- 1 small page-level fix (`app/week/page.tsx` adds `dynamic = 'force-dynamic'`)

All spec requirements implemented, all edge cases handled, no placeholders, fresh test coverage for both new scoring helpers, no regressions on Today tab.
