# This Week / Summary Tab Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Month" tab with "This Week" (Monday–today, resets weekly) and keep "Summary" as full challenge totals, both using the two-column Today-style layout.

**Architecture:** Add a new `/week` route backed by a `WeekView` client component that computes week boundaries locally (timezone-safe). Rewrite `ScoreSummary` to a two-column layout matching Today. Delete the old Month route and components. Update Navbar.

**Tech Stack:** Next.js 16 App Router, Supabase SSR, TypeScript, Tailwind CSS, Jest

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `lib/scoring.ts` | Add `getWeekStart(date: Date): Date` export |
| Modify | `lib/__tests__/scoring.test.ts` | Tests for `getWeekStart` |
| Create | `app/week/page.tsx` | Server component — fetch challenge + 14 days of check-ins |
| Create | `app/week/loading.tsx` | Skeleton loader for `/week` |
| Create | `components/week/WeekView.tsx` | Client component — local weekStart, two-column layout |
| Rewrite | `components/wrap-up/ScoreSummary.tsx` | Two-column Today-style layout for full challenge totals |
| Modify | `app/wrap-up/page.tsx` | Fix unbounded check-in query (add date range) |
| Modify | `components/layout/Navbar.tsx` | `/month` → `/week`, label "Month" → "This Week" |
| Delete | `app/month/page.tsx` | No longer needed |
| Delete | `app/month/loading.tsx` | No longer needed |
| Delete | `components/month/ProgressView.tsx` | Replaced by WeekView |
| Delete | `components/month/GoalDrillDown.tsx` | Not used in new design |

---

## Week Math

```
// Monday of current week, local timezone
getWeekStart(date: Date): Date
  diff = (date.getDay() + 6) % 7   // 0 on Mon, 6 on Sun
  return date - diff days

// Days elapsed this week (1 on Monday, 7 on Sunday)
daysElapsed = floor((todayMidnight - weekStart) / 86400000) + 1

// Filter check-ins to this week
weekCheckIns = checkIns.filter(c => c.date >= weekStartStr && c.date <= today)
```

Score functions (`scoreGoal`, `scoreChallenge`) already accept `totalDays` — pass `daysElapsed` for week scoring.

---

## Task 1: Add `getWeekStart` to scoring lib

**Files:**
- Modify: `lib/scoring.ts`
- Modify: `lib/__tests__/scoring.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `lib/__tests__/scoring.test.ts` and add after the existing tests:

```ts
import { scoreGoal, scoreChallenge, getWeekStart } from '../scoring'

describe('getWeekStart', () => {
  it('returns Monday when given a Monday', () => {
    // 2026-04-27 is a Monday
    const result = getWeekStart(new Date(2026, 3, 27))
    expect(result).toEqual(new Date(2026, 3, 27))
  })

  it('returns the previous Monday when given a Wednesday', () => {
    // 2026-04-29 is a Wednesday → Monday 2026-04-27
    const result = getWeekStart(new Date(2026, 3, 29))
    expect(result).toEqual(new Date(2026, 3, 27))
  })

  it('returns the previous Monday when given a Sunday', () => {
    // 2026-05-03 is a Sunday → Monday 2026-04-27
    const result = getWeekStart(new Date(2026, 4, 3))
    expect(result).toEqual(new Date(2026, 3, 27))
  })

  it('returns midnight (no time component)', () => {
    const result = getWeekStart(new Date(2026, 3, 30, 15, 30, 0))
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd C:/Users/Admin/accountabilibuddies
npm test -- --testPathPattern=scoring --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `getWeekStart is not a function`

- [ ] **Step 3: Add `getWeekStart` to `lib/scoring.ts`**

Add this export at the top of `lib/scoring.ts`, before the existing functions:

```ts
export function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = (d.getDay() + 6) % 7 // 0=Mon, 1=Tue, ..., 6=Sun
  d.setDate(d.getDate() - diff)
  return d
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=scoring --no-coverage 2>&1 | tail -20
```

Expected: PASS — all `getWeekStart` and existing tests green

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts lib/__tests__/scoring.test.ts
git commit -m "feat: add getWeekStart to scoring lib"
```

---

## Task 2: Create the `/week` server route

**Files:**
- Create: `app/week/page.tsx`
- Create: `app/week/loading.tsx`

- [ ] **Step 1: Create `app/week/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WeekView from '@/components/week/WeekView'
import type { ChallengeWithProfiles, Profile } from '@/types/database'

export default async function WeekPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: challenge } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!challenge) redirect('/dashboard')

  const typedChallenge = challenge as unknown as ChallengeWithProfiles
  const buddyId = typedChallenge.creator_id === user.id
    ? typedChallenge.buddy_id
    : typedChallenge.creator_id

  if (!buddyId) redirect('/dashboard')

  // Fetch last 14 days generously — client will filter to Mon–today locally
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  const windowStart = fourteenDaysAgo.toISOString().split('T')[0]

  const [goalsRes, myCheckInsRes, buddyCheckInsRes, myProfileRes] = await Promise.all([
    supabase.from('goals').select('*').eq('challenge_id', typedChallenge.id),
    supabase.from('check_ins').select('*').eq('user_id', user.id).gte('date', windowStart),
    supabase.from('check_ins').select('*').eq('user_id', buddyId).gte('date', windowStart),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ])

  if (!myProfileRes.data) redirect('/auth/login')

  const allGoals = goalsRes.data ?? []
  const buddyProfile = (typedChallenge.creator_id === user.id
    ? typedChallenge.buddy
    : typedChallenge.creator) as Profile | null

  return (
    <WeekView
      myGoals={allGoals.filter(g => g.user_id === user.id)}
      buddyGoals={allGoals.filter(g => g.user_id === buddyId)}
      myCheckIns={myCheckInsRes.data ?? []}
      buddyCheckIns={buddyCheckInsRes.data ?? []}
      myProfile={myProfileRes.data}
      buddyProfile={buddyProfile}
      challengeName={typedChallenge.month_name}
    />
  )
}
```

- [ ] **Step 2: Create `app/week/loading.tsx`**

```tsx
export default function WeekLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
      {/* Header banner */}
      <div className="rounded-2xl h-28 bg-gray-200 mb-6" />

      {/* Score tiles */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl h-24 bg-gray-200" />
        <div className="rounded-2xl h-24 bg-gray-200" />
      </div>

      {/* Goal cards */}
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map(col => (
          <div key={col} className="space-y-2">
            <div className="h-5 w-16 bg-gray-200 rounded-full mb-3" />
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-xl h-20 bg-gray-200" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Confirm the files were created**

```bash
ls C:/Users/Admin/accountabilibuddies/app/week/
```

Expected: `loading.tsx  page.tsx`

- [ ] **Step 4: Commit**

```bash
git add app/week/page.tsx app/week/loading.tsx
git commit -m "feat: add /week server route with 14-day check-in window"
```

---

## Task 3: Create `WeekView` client component

**Files:**
- Create: `components/week/WeekView.tsx`

- [ ] **Step 1: Create `components/week/WeekView.tsx`**

```tsx
'use client'

import { getWeekStart, scoreChallenge, scoreGoal } from '@/lib/scoring'
import type { Goal, CheckIn, Profile } from '@/types/database'

interface Props {
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  myProfile: Profile
  buddyProfile: Profile | null
  challengeName: string
}

export default function WeekView({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myProfile, buddyProfile, challengeName,
}: Props) {
  // Compute today and weekStart in user's local timezone
  const now = new Date()
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = getWeekStart(todayMidnight)
  const weekStartStr = [
    weekStart.getFullYear(),
    String(weekStart.getMonth() + 1).padStart(2, '0'),
    String(weekStart.getDate()).padStart(2, '0'),
  ].join('-')

  // Days elapsed since Monday (1 on Monday, 7 on Sunday)
  const daysElapsed = Math.floor((todayMidnight.getTime() - weekStart.getTime()) / 86400000) + 1

  // Slice check-ins to Mon–today only
  const weekMy = myCheckIns.filter(c => c.date >= weekStartStr && c.date <= today)
  const weekBuddy = buddyCheckIns.filter(c => c.date >= weekStartStr && c.date <= today)

  const myScore = scoreChallenge(myGoals, weekMy, daysElapsed)
  const buddyScore = scoreChallenge(buddyGoals, weekBuddy, daysElapsed)
  const iWon = myScore > buddyScore
  const tied = myScore === buddyScore

  function goalLabel(goal: Goal, checkIns: CheckIn[]) {
    const relevant = checkIns.filter(c => c.goal_id === goal.id && c.completed)
    if (goal.type === 'daily') return `${relevant.length}/${daysElapsed} days`
    if (goal.type === 'milestone') return relevant.length > 0 ? 'Done ✓' : 'Not yet'
    return `${relevant.length}/${goal.target_count ?? 1} times`
  }

  function GoalCard({ goal, checkIns }: { goal: Goal; checkIns: CheckIn[] }) {
    const pct = Math.round(scoreGoal(goal, checkIns, daysElapsed) * 100)
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-1">
          <p className="flex-1 text-sm font-bold text-gray-800">{goal.title}</p>
          <span className="text-sm font-black" style={{ color: '#0077B6' }}>{pct}%</span>
        </div>
        <p className="text-xs text-gray-400 mb-2">{goalLabel(goal, checkIns)}</p>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #00C9A7, #0077B6)' }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header banner */}
      <div
        className="rounded-2xl p-6 mb-6 text-white"
        style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
      >
        <p className="text-white/70 text-sm font-semibold uppercase tracking-wide">
          {challengeName}
        </p>
        <h1 className="text-3xl font-black mt-1">This Week</h1>
        <p className="text-white/60 text-sm mt-1">
          {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' – '}
          {todayMidnight.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' · '}
          Day {daysElapsed} of 7
        </p>
      </div>

      {/* Score tiles */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { profile: myProfile, score: myScore, isWinner: !tied && iWon },
          { profile: buddyProfile, score: buddyScore, isWinner: !tied && !iWon },
        ].map(({ profile, score, isWinner }) => (
          <div
            key={profile?.id ?? 'buddy'}
            className="rounded-2xl border-2 p-5 text-center"
            style={{
              borderColor: isWinner ? '#F9F871' : '#e5e7eb',
              background: isWinner ? '#fffde7' : 'white',
            }}
          >
            {isWinner && (
              <p className="text-xs font-black text-yellow-600 mb-1">🏆 WINNING</p>
            )}
            <p className="text-sm font-bold text-gray-500">{profile?.name ?? 'Buddy'}</p>
            <p className="text-4xl font-black mt-1" style={{ color: '#0077B6' }}>{score}%</p>
          </div>
        ))}
      </div>

      {tied && (
        <p className="text-center text-gray-500 text-sm mb-6 font-semibold">Tied so far! 🤝</p>
      )}

      {/* Two-column goal cards */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-black text-gray-900 mb-3">You</p>
          <div className="space-y-2">
            {myGoals.map(goal => (
              <GoalCard key={goal.id} goal={goal} checkIns={weekMy} />
            ))}
          </div>
        </div>

        <div>
          <p className="font-black text-gray-900 mb-3">{buddyProfile?.name ?? 'Buddy'}</p>
          <div className="space-y-2">
            {buddyGoals.map(goal => (
              <GoalCard key={goal.id} goal={goal} checkIns={weekBuddy} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Confirm the file was created**

```bash
ls C:/Users/Admin/accountabilibuddies/components/week/
```

Expected: `WeekView.tsx`

- [ ] **Step 3: Confirm TypeScript compiles**

```bash
cd C:/Users/Admin/accountabilibuddies && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing unrelated errors)

- [ ] **Step 4: Commit**

```bash
git add components/week/WeekView.tsx
git commit -m "feat: add WeekView client component with local timezone week boundaries"
```

---

## Task 4: Rewrite ScoreSummary + fix unbounded wrap-up query

**Files:**
- Rewrite: `components/wrap-up/ScoreSummary.tsx`
- Modify: `app/wrap-up/page.tsx`

- [ ] **Step 1: Rewrite `components/wrap-up/ScoreSummary.tsx`**

Replace the entire file with:

```tsx
import type { Goal, CheckIn, Profile } from '@/types/database'
import { scoreChallenge, scoreGoal } from '@/lib/scoring'
import Link from 'next/link'

interface Props {
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  myProfile: Profile
  buddyProfile: Profile | null
  totalDays: number
  challengeName: string
  isComplete: boolean
}

export default function ScoreSummary({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myProfile, buddyProfile, totalDays, challengeName, isComplete,
}: Props) {
  const myScore = scoreChallenge(myGoals, myCheckIns, totalDays)
  const buddyScore = scoreChallenge(buddyGoals, buddyCheckIns, totalDays)
  const iWon = myScore > buddyScore
  const tied = myScore === buddyScore

  function GoalCard({ goal, checkIns }: { goal: Goal; checkIns: CheckIn[] }) {
    const pct = Math.round(scoreGoal(goal, checkIns, totalDays) * 100)
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="flex-1 text-sm font-bold text-gray-800">{goal.title}</p>
          <span
            className="text-sm font-black"
            style={{ color: pct >= 80 ? '#00C9A7' : pct >= 50 ? '#0077B6' : '#ef4444' }}
          >
            {pct}%
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #00C9A7, #0077B6)' }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header banner */}
      <div
        className="rounded-2xl p-6 mb-6 text-white"
        style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
      >
        <p className="text-white/70 text-sm font-semibold uppercase tracking-wide">
          {isComplete ? 'Final Results' : 'Full Challenge'}
        </p>
        <h1 className="text-3xl font-black mt-1">{challengeName}</h1>
      </div>

      {/* Score tiles */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { profile: myProfile, score: myScore, isWinner: !tied && iWon },
          { profile: buddyProfile, score: buddyScore, isWinner: !tied && !iWon },
        ].map(({ profile, score, isWinner }) => (
          <div
            key={profile?.id ?? 'buddy'}
            className="rounded-2xl border-2 p-5 text-center"
            style={{
              borderColor: isWinner ? '#F9F871' : '#e5e7eb',
              background: isWinner ? '#fffde7' : 'white',
            }}
          >
            {isWinner && (
              <p className="text-xs font-black text-yellow-600 mb-1">
                {isComplete ? '🏆 WINNER' : '🏆 WINNING'}
              </p>
            )}
            <p className="text-sm font-bold text-gray-500">{profile?.name ?? 'Buddy'}</p>
            <p className="text-4xl font-black mt-1" style={{ color: '#0077B6' }}>{score}%</p>
          </div>
        ))}
      </div>

      {tied && (
        <p className="text-center text-gray-500 text-sm mb-6 font-semibold">It's a tie! 🤝</p>
      )}

      {/* Two-column goal cards */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-black text-gray-900 mb-3">You</p>
          <div className="space-y-2">
            {myGoals.map(goal => (
              <GoalCard key={goal.id} goal={goal} checkIns={myCheckIns} />
            ))}
          </div>
        </div>

        <div>
          <p className="font-black text-gray-900 mb-3">{buddyProfile?.name ?? 'Buddy'}</p>
          <div className="space-y-2">
            {buddyGoals.map(goal => (
              <GoalCard key={goal.id} goal={goal} checkIns={buddyCheckIns} />
            ))}
          </div>
        </div>
      </div>

      {isComplete && (
        <Link
          href="/dashboard"
          className="block w-full text-center py-3 rounded-xl font-bold text-sm mt-6"
          style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)', color: 'white' }}
        >
          Start a new challenge →
        </Link>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Fix the unbounded check-in query in `app/wrap-up/page.tsx`**

In `app/wrap-up/page.tsx`, the two check-in queries currently have no date filter:

```ts
supabase.from('check_ins').select('*').eq('user_id', user.id),
supabase.from('check_ins').select('*').eq('user_id', buddyId!),
```

Replace them with date-bounded versions (using the challenge start/end dates):

```ts
supabase.from('check_ins').select('*').eq('user_id', user.id)
  .gte('date', typedChallenge.start_date)
  .lte('date', typedChallenge.end_date),
supabase.from('check_ins').select('*').eq('user_id', buddyId!)
  .gte('date', typedChallenge.start_date)
  .lte('date', typedChallenge.end_date),
```

- [ ] **Step 3: Confirm TypeScript compiles**

```bash
cd C:/Users/Admin/accountabilibuddies && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add components/wrap-up/ScoreSummary.tsx app/wrap-up/page.tsx
git commit -m "feat: rewrite ScoreSummary to two-column layout, fix unbounded check-in query"
```

---

## Task 5: Update Navbar + delete old Month files

**Files:**
- Modify: `components/layout/Navbar.tsx`
- Delete: `app/month/page.tsx`
- Delete: `app/month/loading.tsx`
- Delete: `components/month/ProgressView.tsx`
- Delete: `components/month/GoalDrillDown.tsx`

- [ ] **Step 1: Update `components/layout/Navbar.tsx`**

Change the `navItems` array from:

```ts
const navItems = [
  { href: '/dashboard', label: 'Today' },
  { href: '/month', label: 'Month' },
  { href: '/wrap-up', label: 'Summary' },
]
```

To:

```ts
const navItems = [
  { href: '/dashboard', label: 'Today' },
  { href: '/week', label: 'This Week' },
  { href: '/wrap-up', label: 'Summary' },
]
```

Also update the `prefetch` `<Link>` — the href `/week` now routes to the new page, which is correct.

- [ ] **Step 2: Delete the old Month files**

```bash
rm C:/Users/Admin/accountabilibuddies/app/month/page.tsx
rm C:/Users/Admin/accountabilibuddies/app/month/loading.tsx
rmdir C:/Users/Admin/accountabilibuddies/app/month
rm C:/Users/Admin/accountabilibuddies/components/month/ProgressView.tsx
rm C:/Users/Admin/accountabilibuddies/components/month/GoalDrillDown.tsx
rmdir C:/Users/Admin/accountabilibuddies/components/month
```

- [ ] **Step 3: Confirm TypeScript compiles with no import errors**

```bash
cd C:/Users/Admin/accountabilibuddies && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors about missing imports

- [ ] **Step 4: Run all tests to confirm nothing broke**

```bash
cd C:/Users/Admin/accountabilibuddies && npm test -- --no-coverage 2>&1 | tail -20
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: update navbar to This Week tab, delete old Month route and components"
```

---

## Done

After all 5 tasks:
- `/week` → This Week (Mon–today, resets Monday, two-column layout)
- `/wrap-up` → Summary (full challenge totals, two-column layout)
- `/month` route is gone
- Navbar shows: Today | This Week | Summary
