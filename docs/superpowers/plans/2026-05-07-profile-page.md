# Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a profile page accessible from the navbar (avatar replaces sign-out) showing the user's avatar, achievement stats, and full challenge history with tap-through to historical wrap-up views.

**Architecture:** RSC `app/profile/page.tsx` fetches all data server-side and pre-computes stats, passing them as props to a `ProfileClient` client component. Sub-components (AvatarPicker, StatTile, StreakDetailSheet, ChallengeHistoryCard) are built independently and assembled into ProfileClient. The existing `/wrap-up` route gains an optional `?challenge=<id>` search param to support read-only historical views.

**Tech Stack:** Next.js 15 App Router, Supabase, TypeScript, Tailwind CSS, DiceBear SVG avatars (CDN, no storage), `useOptimistic` for avatar updates, Jest for unit tests.

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `lib/avatar.ts` | `getAvatarUrl(userId, style?)` — deterministic DiceBear URL builder |
| `lib/__tests__/avatar.test.ts` | Unit tests for avatar helper |
| `app/profile/page.tsx` | RSC — fetches profile, challenges, goals, check-ins; pre-computes all stats |
| `app/profile/loading.tsx` | Skeleton loader shown during RSC fetch |
| `app/profile/actions.ts` | `updateAvatarStyle` server action |
| `components/profile/ProfileClient.tsx` | Root client component — grows across tasks |
| `components/profile/AvatarPicker.tsx` | Bottom sheet — 5×6 grid of 30 DiceBear styles |
| `components/profile/StatTile.tsx` | Single tappable stat tile (value + label + optional subtitle) |
| `components/profile/StreakDetailSheet.tsx` | Bottom sheet — best streak detail + current vs best |
| `components/profile/ChallengeHistoryCard.tsx` | Single challenge row card |

### Modified files
| File | Change |
|------|--------|
| `types/database.ts` | Add `avatar_style: string` to `Profile` |
| `lib/scoring.ts` | Add `BestStreakResult`, `GoalStreakContext`, `getBestStreak` |
| `lib/__tests__/scoring.test.ts` | Append `getBestStreak` tests |
| `app/layout.tsx` | Fetch profile server-side, pass `avatarUrl` to Navbar |
| `components/layout/Navbar.tsx` | Replace sign-out button with avatar circle linking to `/profile` |
| `components/wrap-up/ScoreSummary.tsx` | Accept `isHistorical?: boolean` and `backHref?: string` props |
| `app/wrap-up/page.tsx` | Accept optional `?challenge=<id>` search param |

---

## BATCH A — Foundation

### Task 1: DB Migration + Profile Type

**Files:**
- Modify: `types/database.ts`
- Migration: run in Supabase SQL editor

- [ ] **Step 1: Run the migration in Supabase**

Open the Supabase dashboard → SQL editor → paste and run:

```sql
ALTER TABLE profiles ADD COLUMN avatar_style text NOT NULL DEFAULT 'avataaars';
```

- [ ] **Step 2: Verify the column exists**

In Supabase Table Editor, open the `profiles` table. Confirm `avatar_style` column appears with type `text` and default value `avataaars`. Check that existing rows have `avataaars` filled in (not NULL).

- [ ] **Step 3: Update `types/database.ts`**

Replace the existing `Profile` interface with:

```ts
export interface Profile {
  id: string
  name: string
  avatar_url: string | null      // reserved for future photo upload
  avatar_style: string           // DiceBear style slug, default 'avataaars'
  notification_time: string
  created_at: string
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd C:/Users/Admin/accountabilibuddies
npx tsc --noEmit
```

Expected: no errors. If you see errors about `avatar_style` not existing on Profile — double-check the interface was saved correctly.

- [ ] **Step 5: Commit**

```bash
git add types/database.ts
git commit -m "feat: add avatar_style column to profiles type"
```

---

### Task 2: Avatar Helper

**Files:**
- Create: `lib/avatar.ts`
- Create: `lib/__tests__/avatar.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/avatar.test.ts`:

```ts
import { getAvatarUrl } from '../avatar'

describe('getAvatarUrl', () => {
  it('builds a DiceBear URL with the given style and userId', () => {
    const url = getAvatarUrl('user-123', 'bottts')
    expect(url).toBe('https://api.dicebear.com/9.x/bottts/svg?seed=user-123')
  })

  it('defaults to avataaars when no style provided', () => {
    const url = getAvatarUrl('user-456')
    expect(url).toBe('https://api.dicebear.com/9.x/avataaars/svg?seed=user-456')
  })

  it('defaults to avataaars when style is empty string', () => {
    const url = getAvatarUrl('user-789', '')
    expect(url).toBe('https://api.dicebear.com/9.x/avataaars/svg?seed=user-789')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="avatar" --no-coverage
```

Expected: FAIL — `Cannot find module '../avatar'`

- [ ] **Step 3: Create `lib/avatar.ts`**

```ts
const DICEBEAR_BASE = 'https://api.dicebear.com/9.x'
const DEFAULT_STYLE = 'avataaars'

export function getAvatarUrl(userId: string, style?: string): string {
  const s = style?.trim() || DEFAULT_STYLE
  return `${DICEBEAR_BASE}/${s}/svg?seed=${userId}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="avatar" --no-coverage
```

Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/avatar.ts lib/__tests__/avatar.test.ts
git commit -m "feat: add DiceBear avatar URL helper"
```

---

### Task 3: getBestStreak Function

**Files:**
- Modify: `lib/scoring.ts` (append at bottom)
- Modify: `lib/__tests__/scoring.test.ts` (append at bottom)

- [ ] **Step 1: Write the failing tests**

Append to the end of `lib/__tests__/scoring.test.ts`:

```ts
import { getBestStreak } from '../scoring'
import type { GoalStreakContext } from '../scoring'

// ─── getBestStreak ────────────────────────────────────────────────────────────

describe('getBestStreak', () => {
  const ctx = (goal: Goal, challengeName = 'Jan Challenge', buddyName = 'Alex'): GoalStreakContext => ({
    goal, challengeName, buddyName,
  })

  it('returns null when no check-ins exist', () => {
    const goal = makeGoal({ type: 'daily' })
    expect(getBestStreak([ctx(goal)], [])).toBeNull()
  })

  it('returns a single-day streak for one check-in', () => {
    const goal = makeGoal({ id: 'g1', type: 'daily' })
    const result = getBestStreak([ctx(goal)], [makeCheckIn({ goal_id: 'g1', date: '2026-01-01' })])
    expect(result).not.toBeNull()
    expect(result!.days).toBe(1)
    expect(result!.startDate).toBe('2026-01-01')
    expect(result!.endDate).toBe('2026-01-01')
  })

  it('finds a consecutive calendar-day streak for a daily goal', () => {
    const goal = makeGoal({ id: 'g1', type: 'daily' })
    const checkIns = [
      makeCheckIn({ goal_id: 'g1', date: '2026-01-01' }),
      makeCheckIn({ goal_id: 'g1', date: '2026-01-02' }),
      makeCheckIn({ goal_id: 'g1', date: '2026-01-03' }),
      // gap
      makeCheckIn({ goal_id: 'g1', date: '2026-01-05' }),
    ]
    const result = getBestStreak([ctx(goal)], checkIns)
    expect(result!.days).toBe(3)
    expect(result!.startDate).toBe('2026-01-01')
    expect(result!.endDate).toBe('2026-01-03')
  })

  it('finds best streak across multiple goals, picks highest', () => {
    const g1 = makeGoal({ id: 'g1', type: 'daily' })
    const g2 = makeGoal({ id: 'g2', type: 'daily' })
    const checkIns = [
      makeCheckIn({ goal_id: 'g1', date: '2026-01-01' }),
      makeCheckIn({ goal_id: 'g1', date: '2026-01-02' }),
      makeCheckIn({ goal_id: 'g2', date: '2026-02-01' }),
      makeCheckIn({ goal_id: 'g2', date: '2026-02-02' }),
      makeCheckIn({ goal_id: 'g2', date: '2026-02-03' }),
      makeCheckIn({ goal_id: 'g2', date: '2026-02-04' }),
    ]
    const result = getBestStreak([ctx(g1, 'Jan', 'Alex'), ctx(g2, 'Feb', 'Alex')], checkIns)
    expect(result!.days).toBe(4)
    expect(result!.goalTitle).toBe('Test Goal')
    expect(result!.challengeName).toBe('Feb')
  })

  it('counts consecutive schedule_dates for a frequency goal (not calendar days)', () => {
    // schedule: every Monday/Wednesday/Friday
    const goal = makeGoal({
      id: 'g1',
      type: 'frequency',
      target_count: 3,
      schedule_dates: ['2026-01-05', '2026-01-07', '2026-01-09', '2026-01-12', '2026-01-14'],
    })
    // Completed first 3 scheduled dates = streak of 3
    const checkIns = [
      makeCheckIn({ goal_id: 'g1', date: '2026-01-05' }),
      makeCheckIn({ goal_id: 'g1', date: '2026-01-07' }),
      makeCheckIn({ goal_id: 'g1', date: '2026-01-09' }),
      // missed Jan 12
      makeCheckIn({ goal_id: 'g1', date: '2026-01-14' }),
    ]
    const result = getBestStreak([ctx(goal)], checkIns)
    expect(result!.days).toBe(3)
    expect(result!.startDate).toBe('2026-01-05')
    expect(result!.endDate).toBe('2026-01-09')
  })

  it('attaches correct goal title, challenge name, buddy name', () => {
    const goal = makeGoal({ id: 'g1', type: 'daily', title: 'Attend BJJ' })
    const checkIns = [makeCheckIn({ goal_id: 'g1', date: '2026-03-01' })]
    const result = getBestStreak([ctx(goal, 'Mar Challenge', 'Alex')], checkIns)
    expect(result!.goalTitle).toBe('Attend BJJ')
    expect(result!.challengeName).toBe('Mar Challenge')
    expect(result!.buddyName).toBe('Alex')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="scoring" --no-coverage
```

Expected: FAIL — `getBestStreak is not a function` / `GoalStreakContext is not exported`

- [ ] **Step 3: Add `getBestStreak` to `lib/scoring.ts`**

Append at the bottom of `lib/scoring.ts` (after `scoreChallenge`):

```ts
// ── Best Streak ───────────────────────────────────────────────────────────────

export interface BestStreakResult {
  days: number
  goalTitle: string
  challengeName: string
  buddyName: string
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
}

export interface GoalStreakContext {
  goal: Goal
  challengeName: string
  buddyName: string
}

export function getBestStreak(
  goalContexts: GoalStreakContext[],
  allCheckIns: CheckIn[],
): BestStreakResult | null {
  let best: BestStreakResult | null = null

  for (const { goal, challengeName, buddyName } of goalContexts) {
    const done = new Set(
      allCheckIns.filter(c => c.goal_id === goal.id && c.completed).map(c => c.date)
    )
    if (done.size === 0) continue

    const { days, startDate, endDate } = findBestRun(goal, done)
    if (days > (best?.days ?? 0)) {
      best = { days, goalTitle: goal.title, challengeName, buddyName, startDate, endDate }
    }
  }

  return best
}

function findBestRun(
  goal: Goal,
  done: Set<string>,
): { days: number; startDate: string; endDate: string } {
  if (!goal.schedule_dates || goal.schedule_dates.length === 0) {
    // Daily goal: longest run of consecutive calendar days
    return longestConsecutiveCalendarRun([...done].sort())
  }

  // Frequency goal: longest run of consecutive *scheduled* dates that are completed
  const scheduled = [...goal.schedule_dates].sort()
  let bestDays = 0, bestStart = '', bestEnd = ''
  let runStart = '', runLen = 0

  for (const date of scheduled) {
    if (done.has(date)) {
      if (runLen === 0) runStart = date
      runLen++
      if (runLen > bestDays) {
        bestDays = runLen
        bestStart = runStart
        bestEnd = date
      }
    } else {
      runLen = 0
    }
  }

  return { days: bestDays, startDate: bestStart, endDate: bestEnd }
}

function longestConsecutiveCalendarRun(
  sortedDates: string[],
): { days: number; startDate: string; endDate: string } {
  if (sortedDates.length === 0) return { days: 0, startDate: '', endDate: '' }

  let bestDays = 1, bestStart = sortedDates[0], bestEnd = sortedDates[0]
  let runStart = sortedDates[0], runLen = 1

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1])
    const curr = new Date(sortedDates[i])
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000)

    if (diff === 1) {
      runLen++
      if (runLen > bestDays) {
        bestDays = runLen
        bestStart = runStart
        bestEnd = sortedDates[i]
      }
    } else {
      runStart = sortedDates[i]
      runLen = 1
    }
  }

  return { days: bestDays, startDate: bestStart, endDate: bestEnd }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="scoring" --no-coverage
```

Expected: PASS — all existing scoring tests + new `getBestStreak` tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts lib/__tests__/scoring.test.ts
git commit -m "feat: add getBestStreak function with tests"
```

---

## BATCH B — Entry Point

### Task 4: Root Layout + Navbar Update

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/layout/Navbar.tsx`

> ⚠️ **Deploy risk:** The sign-out button disappears from the navbar. The profile page (Task 5) MUST be deployed in the same push. Do not deploy this task alone.

- [ ] **Step 1: Update `app/layout.tsx`** to fetch profile and pass avatarUrl to Navbar

Replace the entire file:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import { createClient } from '@/lib/supabase/server'
import { getAvatarUrl } from '@/lib/avatar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Accountabilibuddies',
  description: 'Track goals with your accountability buddy',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  manifest: '/manifest.json',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let avatarUrl: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_style')
      .eq('id', user.id)
      .single()
    avatarUrl = getAvatarUrl(user.id, profile?.avatar_style ?? 'avataaars')
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        {user && <Navbar avatarUrl={avatarUrl} />}
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Update `components/layout/Navbar.tsx`** to replace sign-out with avatar circle

Replace the entire file:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BRAND_GRADIENT } from '@/lib/brand'

interface Props {
  avatarUrl: string | null
}

export default function Navbar({ avatarUrl }: Props) {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: 'Today' },
    { href: '/week', label: 'This Week' },
    { href: '/wrap-up', label: 'Summary' },
  ]

  return (
    <div className="w-full sticky top-0 z-50">
      {/* Brand bar */}
      <div
        className="w-full px-4 py-3 flex items-center justify-between"
        style={{ background: BRAND_GRADIENT }}
      >
        <span className="text-white font-black text-lg tracking-tight">
          Accountabilibuddies
        </span>

        {/* Avatar circle → /profile */}
        <Link
          href="/profile"
          className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/40 hover:border-white/80 transition flex-shrink-0"
          aria-label="Your profile"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              width={32}
              height={32}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback: hide broken image, show initials circle
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className="w-full h-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-xs font-bold">?</span>
            </div>
          )}
        </Link>
      </div>

      {/* Nav tab bar */}
      <div className="w-full bg-white border-b border-gray-100 flex">
        {navItems.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              prefetch={true}
              className={`flex-1 text-center py-2.5 text-sm font-bold transition border-b-2 ${
                active
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit** (will be deployed alongside Task 5)

```bash
git add app/layout.tsx components/layout/Navbar.tsx
git commit -m "feat: replace navbar sign-out with avatar circle linking to /profile"
```

---

### Task 5: Profile Page Scaffold

**Files:**
- Create: `app/profile/page.tsx`
- Create: `app/profile/loading.tsx`
- Create: `components/profile/ProfileClient.tsx`

This task creates a minimal but deployable profile page: avatar (96px), name, active challenge line, sign-out button. Stats and history are placeholders. This is the minimal safe state that makes the avatar navbar link functional.

- [ ] **Step 1: Create `app/profile/loading.tsx`**

```tsx
export default function ProfileLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
      {/* Avatar skeleton */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="w-24 h-24 rounded-full bg-gray-200" />
        <div className="h-5 w-32 bg-gray-200 rounded-full" />
        <div className="h-4 w-40 bg-gray-100 rounded-full" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-2xl" />
        ))}
      </div>

      {/* History skeleton */}
      <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
      {[0, 1, 2].map(i => (
        <div key={i} className="h-20 bg-gray-100 rounded-2xl mb-3" />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/profile/ProfileClient.tsx`** (minimal scaffold)

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, ChallengeWithProfiles } from '@/types/database'
import { getAvatarUrl } from '@/lib/avatar'
import { BRAND_GRADIENT } from '@/lib/brand'

interface Props {
  profile: Profile
  activeChallenge: ChallengeWithProfiles | null
  avatarUrl: string
}

export default function ProfileClient({ profile, activeChallenge, avatarUrl }: Props) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const activeLine = activeChallenge
    ? (() => {
        const start = new Date(activeChallenge.start_date)
        const today = new Date()
        const dayNumber = Math.max(
          1,
          Math.floor((today.getTime() - start.getTime()) / 86400000) + 1
        )
        const totalDays = Math.floor(
          (new Date(activeChallenge.end_date).getTime() - start.getTime()) / 86400000
        ) + 1
        return `Day ${dayNumber} of ${totalDays} · ${activeChallenge.month_name}`
      })()
    : 'No active challenge'

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-100 shadow-sm">
          <img
            src={avatarUrl}
            alt="Your avatar"
            width={96}
            height={96}
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="text-xl font-black text-gray-800">{profile.name}</h1>
        <p className="text-sm text-gray-400 font-semibold">{activeLine}</p>
      </div>

      {/* Stats placeholder */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {['challenges', 'win rate', 'streak', 'check-ins'].map(label => (
          <div key={label} className="rounded-2xl bg-gray-50 px-2 py-4 text-center">
            <div className="h-5 w-8 bg-gray-200 rounded mx-auto mb-1 animate-pulse" />
            <p className="text-xs text-gray-400 font-semibold">{label}</p>
          </div>
        ))}
      </div>

      {/* History placeholder */}
      <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-3">
        Challenge History
      </p>
      <div className="rounded-2xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
        Loading history…
      </div>

      {/* Sign out */}
      <div className="mt-12 flex justify-center">
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-400 font-semibold hover:text-gray-600 transition"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/profile/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAvatarUrl } from '@/lib/avatar'
import ProfileClient from '@/components/profile/ProfileClient'
import type { ChallengeWithProfiles } from '@/types/database'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  const { data: challengesData } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  const challenges = (challengesData ?? []) as ChallengeWithProfiles[]
  const activeChallenge = challenges.find(c => c.status === 'active') ?? null
  const avatarUrl = getAvatarUrl(user.id, profile.avatar_style)

  return (
    <ProfileClient
      profile={profile}
      activeChallenge={activeChallenge}
      avatarUrl={avatarUrl}
    />
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Start dev server and verify manually**

```bash
npm run dev
```

Navigate to `http://localhost:3000`. Verify:
- Navbar shows avatar circle in top-right (32px, circular)
- Clicking avatar navigates to `/profile`
- Profile page shows: avatar (96px), name, active challenge line or "No active challenge"
- Sign-out button at bottom works (signs out, redirects to `/`)
- Stats tiles show loading skeleton state

- [ ] **Step 6: Commit**

```bash
git add app/profile/page.tsx app/profile/loading.tsx components/profile/ProfileClient.tsx
git commit -m "feat: profile page scaffold with avatar, name, active challenge, sign-out"
```

---

## BATCH C — Avatar Picker

### Task 6: updateAvatarStyle Server Action

**Files:**
- Create: `app/profile/actions.ts`

- [ ] **Step 1: Create `app/profile/actions.ts`**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const VALID_STYLES = new Set([
  'adventurer', 'adventurer-neutral', 'avataaars', 'avataaars-neutral',
  'big-ears', 'big-ears-neutral', 'big-smile', 'bottts', 'bottts-neutral',
  'croodles', 'croodles-neutral', 'dylan', 'fun-emoji', 'glass', 'icons',
  'identicon', 'initials', 'lorelei', 'lorelei-neutral', 'micah', 'miniavs',
  'notionists', 'notionists-neutral', 'open-peeps', 'personas', 'pixel-art',
  'pixel-art-neutral', 'rings', 'shapes', 'thumbs',
])

export async function updateAvatarStyle(style: string): Promise<{ error: string | null }> {
  if (!VALID_STYLES.has(style)) {
    return { error: 'Invalid avatar style' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_style: style })
    .eq('id', user.id)

  if (error) return { error: error.message }

  // Revalidate both profile page and root layout (for navbar avatar)
  revalidatePath('/profile')
  revalidatePath('/', 'layout')

  return { error: null }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/profile/actions.ts
git commit -m "feat: updateAvatarStyle server action with style validation"
```

---

### Task 7: AvatarPicker Component + ProfileClient Wired Up

**Files:**
- Create: `components/profile/AvatarPicker.tsx`
- Modify: `components/profile/ProfileClient.tsx`

- [ ] **Step 1: Create `components/profile/AvatarPicker.tsx`**

```tsx
'use client'

import { useState, useEffect, useRef, useOptimistic, useTransition } from 'react'
import { getAvatarUrl } from '@/lib/avatar'
import { updateAvatarStyle } from '@/app/profile/actions'

const STYLES = [
  'adventurer', 'adventurer-neutral', 'avataaars', 'avataaars-neutral',
  'big-ears', 'big-ears-neutral', 'big-smile', 'bottts', 'bottts-neutral',
  'croodles', 'croodles-neutral', 'dylan', 'fun-emoji', 'glass', 'icons',
  'identicon', 'initials', 'lorelei', 'lorelei-neutral', 'micah', 'miniavs',
  'notionists', 'notionists-neutral', 'open-peeps', 'personas', 'pixel-art',
  'pixel-art-neutral', 'rings', 'shapes', 'thumbs',
] as const

interface Props {
  userId: string
  currentStyle: string
  onStyleChange: (newStyle: string) => void
  onClose: () => void
}

export default function AvatarPicker({ userId, currentStyle, onStyleChange, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const [, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  function handleClose() {
    setMounted(false)
    setTimeout(onClose, 280)
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    if (deltaY > 60 && (sheetRef.current?.scrollTop ?? 0) === 0) handleClose()
  }

  function handleSelect(style: string) {
    // Optimistic update: tell parent immediately
    onStyleChange(style)
    handleClose()

    startTransition(async () => {
      const result = await updateAvatarStyle(style)
      if (result.error) {
        // Roll back
        onStyleChange(currentStyle)
        setToast('Failed to save avatar. Please try again.')
        setTimeout(() => setToast(null), 3000)
      }
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto transition-transform duration-300 ease-out ${mounted ? 'translate-y-0' : 'translate-y-full'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-black text-gray-800 text-base">Choose your avatar</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Grid: 5 columns × 6 rows = 30 styles */}
        <div className="grid grid-cols-5 gap-3 p-4">
          {STYLES.map(style => {
            const isActive = style === currentStyle
            return (
              <button
                key={style}
                type="button"
                onClick={() => handleSelect(style)}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition active:scale-95 ${
                  isActive ? 'ring-2 ring-teal-500 bg-teal-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                  <img
                    src={getAvatarUrl(userId, style)}
                    alt={style}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <span className="text-gray-400 leading-tight text-center"
                  style={{ fontSize: '9px' }}>
                  {style.replace(/-/g, ' ')}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-60 bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Update `components/profile/ProfileClient.tsx`** with avatar picker wired up

Replace the entire file:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, ChallengeWithProfiles } from '@/types/database'
import { getAvatarUrl } from '@/lib/avatar'
import AvatarPicker from './AvatarPicker'

interface Props {
  profile: Profile
  activeChallenge: ChallengeWithProfiles | null
  avatarUrl: string
}

export default function ProfileClient({ profile, activeChallenge, avatarUrl: initialAvatarUrl }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [avatarStyle, setAvatarStyle] = useState(profile.avatar_style)
  const [showPicker, setShowPicker] = useState(false)

  const avatarUrl = getAvatarUrl(profile.id, avatarStyle)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const activeLine = activeChallenge
    ? (() => {
        const start = new Date(activeChallenge.start_date)
        const today = new Date()
        const dayNumber = Math.max(
          1,
          Math.floor((today.getTime() - start.getTime()) / 86400000) + 1
        )
        const totalDays = Math.floor(
          (new Date(activeChallenge.end_date).getTime() - start.getTime()) / 86400000
        ) + 1
        return `Day ${dayNumber} of ${totalDays} · ${activeChallenge.month_name}`
      })()
    : 'No active challenge'

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-100 shadow-sm hover:opacity-80 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          aria-label="Change avatar"
        >
          <img
            src={avatarUrl}
            alt="Your avatar"
            width={96}
            height={96}
            className="w-full h-full object-cover"
          />
        </button>
        <h1 className="text-xl font-black text-gray-800">{profile.name}</h1>
        <p className="text-sm text-gray-400 font-semibold">{activeLine}</p>
      </div>

      {/* Stats placeholder */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {['challenges', 'win rate', 'streak', 'check-ins'].map(label => (
          <div key={label} className="rounded-2xl bg-gray-50 px-2 py-4 text-center">
            <div className="h-5 w-8 bg-gray-200 rounded mx-auto mb-1 animate-pulse" />
            <p className="text-xs text-gray-400 font-semibold">{label}</p>
          </div>
        ))}
      </div>

      {/* History placeholder */}
      <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-3">
        Challenge History
      </p>
      <div className="rounded-2xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
        Loading history…
      </div>

      {/* Sign out */}
      <div className="mt-12 flex justify-center">
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-400 font-semibold hover:text-gray-600 transition"
        >
          Sign out
        </button>
      </div>

      {/* Avatar picker sheet */}
      {showPicker && (
        <AvatarPicker
          userId={profile.id}
          currentStyle={avatarStyle}
          onStyleChange={setAvatarStyle}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Test manually**

```bash
npm run dev
```

Navigate to `/profile`. Verify:
- Tapping the 96px avatar opens the bottom sheet
- 30 avatar styles appear in a 5-column grid with previews using your userId as seed
- Current style has a teal ring highlight
- Tapping a style closes the sheet and immediately updates the avatar circle (optimistic)
- The navbar avatar also updates on next navigation (after revalidation)
- Swipe down on the sheet dismisses it

- [ ] **Step 5: Commit**

```bash
git add components/profile/AvatarPicker.tsx components/profile/ProfileClient.tsx
git commit -m "feat: avatar picker bottom sheet with 30 DiceBear styles and optimistic update"
```

---

## BATCH D — Stats

### Task 8: StatTile Component

**Files:**
- Create: `components/profile/StatTile.tsx`

- [ ] **Step 1: Create `components/profile/StatTile.tsx`**

```tsx
interface Props {
  value: string
  label: string
  subtitle?: string        // small text below label (e.g. "Attend BJJ · Alex")
  onClick?: () => void
  children?: React.ReactNode  // inline expansion content (win rate breakdown)
}

export default function StatTile({ value, label, subtitle, onClick, children }: Props) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={[
          'rounded-2xl bg-gray-50 px-2 py-4 text-center transition',
          onClick ? 'active:scale-95 hover:bg-gray-100 cursor-pointer' : 'cursor-default',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
        ].join(' ')}
      >
        <p className="text-xl font-black text-gray-800 leading-tight">{value}</p>
        <p className="text-xs text-gray-400 font-semibold mt-0.5">{label}</p>
        {subtitle && (
          <p className="text-gray-300 mt-1 leading-tight px-1 truncate"
            style={{ fontSize: '9px' }}>
            {subtitle}
          </p>
        )}
      </button>

      {/* Inline expansion (e.g. win/loss/tie breakdown) */}
      {children && (
        <div className="mt-2">
          {children}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/profile/StatTile.tsx
git commit -m "feat: StatTile component for profile stats"
```

---

### Task 9: StreakDetailSheet Component

**Files:**
- Create: `components/profile/StreakDetailSheet.tsx`

- [ ] **Step 1: Create `components/profile/StreakDetailSheet.tsx`**

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import type { BestStreakResult } from '@/lib/scoring'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface CurrentStreakInfo {
  days: number
  goalTitle: string
}

interface Props {
  best: BestStreakResult
  current: CurrentStreakInfo | null
  onClose: () => void
}

function MiniCalendar({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)

  // Show the month of startDate (covers most cases; streaks are usually within one month)
  const year = sy
  const month = sm - 1  // 0-based
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7  // 0 = Mon

  const streakStart = new Date(sy, sm - 1, sd)
  const streakEnd = new Date(ey, em - 1, ed)

  return (
    <div className="mt-3 bg-gray-50 rounded-xl p-3">
      <p className="text-xs font-bold text-gray-400 text-center mb-2">
        {MONTHS[month]} {year}
      </p>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center" style={{ fontSize: '9px' }}>
            <span className="text-gray-300 font-semibold">{d}</span>
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDow }, (_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1
          const cellDate = new Date(year, month, dayNum)
          const inStreak = cellDate >= streakStart && cellDate <= streakEnd

          return (
            <div
              key={dayNum}
              className={`aspect-square flex items-center justify-center rounded-full text-xs font-semibold ${
                inStreak
                  ? 'bg-orange-400 text-white'
                  : 'text-gray-300'
              }`}
              style={{ fontSize: '10px' }}
            >
              {dayNum}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function StreakDetailSheet({ best, current, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  function handleClose() {
    setMounted(false)
    setTimeout(onClose, 280)
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    if (deltaY > 60 && (sheetRef.current?.scrollTop ?? 0) === 0) handleClose()
  }

  const daysAway = best.days - (current?.days ?? 0)
  const newPersonalBest = (current?.days ?? 0) > best.days

  function formatDateRange(start: string, end: string): string {
    const fmt = (d: string) => {
      const [y, m, day] = d.split('-').map(Number)
      return new Date(y, m - 1, day).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    }
    return `${fmt(start)} – ${fmt(end)}`
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto transition-transform duration-300 ease-out ${mounted ? 'translate-y-0' : 'translate-y-full'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 py-4">
          {/* Best streak */}
          <div className="mb-5">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">
              All-Time Best
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-gray-800">🔥{best.days}</span>
              <span className="text-base font-bold text-gray-500">days</span>
            </div>
            <p className="text-sm font-semibold text-gray-600 mt-1">{best.goalTitle}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {best.challengeName} · vs {best.buddyName}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDateRange(best.startDate, best.endDate)}
            </p>

            <MiniCalendar startDate={best.startDate} endDate={best.endDate} />
          </div>

          {/* Divider */}
          {current && (
            <>
              <div className="border-t border-gray-100 my-5" />

              {/* Current streak */}
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">
                  Current Streak
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-gray-800">⚡{current.days}</span>
                  <span className="text-base font-bold text-gray-500">days</span>
                </div>
                <p className="text-sm font-semibold text-gray-600 mt-1">{current.goalTitle}</p>
                <p className="text-xs font-semibold mt-2">
                  {newPersonalBest ? (
                    <span className="text-teal-500">🎉 New personal best!</span>
                  ) : daysAway > 0 ? (
                    <span className="text-orange-400">{daysAway} day{daysAway !== 1 ? 's' : ''} away from your best</span>
                  ) : null}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/profile/StreakDetailSheet.tsx
git commit -m "feat: StreakDetailSheet with mini calendar, current vs best comparison"
```

---

### Task 10: Stats Tiles Wired Up

**Files:**
- Modify: `app/profile/page.tsx` (add full data fetching + stat computation)
- Modify: `components/profile/ProfileClient.tsx` (add all 4 stat tiles)

- [ ] **Step 1: Replace `app/profile/page.tsx`** with complete data fetching and stat computation

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAvatarUrl } from '@/lib/avatar'
import ProfileClient from '@/components/profile/ProfileClient'
import type { ChallengeWithProfiles, Goal, CheckIn, Profile } from '@/types/database'
import { getBestStreak, getCurrentStreak, scoreChallenge } from '@/lib/scoring'
import type { BestStreakResult, GoalStreakContext } from '@/lib/scoring'

export interface ProfileStats {
  totalChallenges: number
  wins: number
  losses: number
  ties: number
  bestStreak: BestStreakResult | null
  currentStreak: { days: number; goalTitle: string } | null
  totalCheckIns: number
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  // Fetch all challenges this user participated in
  const { data: challengesData } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  const challenges = (challengesData ?? []) as ChallengeWithProfiles[]
  const challengeIds = challenges.map(c => c.id)

  // Collect all unique user IDs from challenges (user + all buddies)
  const allUserIds = [...new Set([
    user.id,
    ...challenges.flatMap(c => [c.creator_id, c.buddy_id].filter((id): id is string => !!id)),
  ])]

  // Fetch all goals and check-ins for all challenges
  const [allGoalsRes, allCheckInsRes] = await (challengeIds.length > 0
    ? Promise.all([
        supabase.from('goals').select('*').in('challenge_id', challengeIds),
        supabase.from('check_ins').select('*').in('user_id', allUserIds),
      ])
    : Promise.resolve([{ data: [] }, { data: [] }]))

  const allGoals: Goal[] = allGoalsRes.data ?? []
  const allCheckIns: CheckIn[] = allCheckInsRes.data ?? []

  const today = new Date().toISOString().split('T')[0]

  // ── Stat computation ─────────────────────────────────────────────────────────

  const userCheckIns = allCheckIns.filter(c => c.user_id === user.id)

  // Total completed check-ins (user only)
  const totalCheckIns = userCheckIns.filter(c => c.completed).length

  // Win / loss / tie on completed challenges
  const completedChallenges = challenges.filter(c => c.status === 'completed')
  let wins = 0, losses = 0, ties = 0

  for (const challenge of completedChallenges) {
    const buddyId = challenge.creator_id === user.id ? challenge.buddy_id : challenge.creator_id
    if (!buddyId) continue

    const myGoals = allGoals.filter(g => g.challenge_id === challenge.id && g.user_id === user.id)
    const buddyGoals = allGoals.filter(g => g.challenge_id === challenge.id && g.user_id === buddyId)
    const myCheckIns = allCheckIns.filter(c => c.user_id === user.id && myGoals.some(g => g.id === c.goal_id))
    const buddyCheckIns = allCheckIns.filter(c => c.user_id === buddyId && buddyGoals.some(g => g.id === c.goal_id))

    const totalDays = Math.floor(
      (new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / 86400000
    ) + 1

    const myScore = scoreChallenge(myGoals, myCheckIns, totalDays, challenge.start_date, challenge.end_date, true)
    const buddyScore = scoreChallenge(buddyGoals, buddyCheckIns, totalDays, challenge.start_date, challenge.end_date, true)

    if (myScore > buddyScore) wins++
    else if (myScore < buddyScore) losses++
    else ties++
  }

  // Best streak (user's own goals only)
  const userGoals = allGoals.filter(g => g.user_id === user.id)
  const goalContexts: GoalStreakContext[] = userGoals.map(goal => {
    const challenge = challenges.find(c => c.id === goal.challenge_id)
    const buddyProfile = challenge
      ? (challenge.creator_id === user.id ? challenge.buddy : challenge.creator) as Profile | null
      : null
    return {
      goal,
      challengeName: challenge?.month_name ?? '',
      buddyName: buddyProfile?.name ?? 'Buddy',
    }
  })
  const bestStreak = getBestStreak(goalContexts, userCheckIns)

  // Current streak: best active streak across the active challenge's goals
  const activeChallenge = challenges.find(c => c.status === 'active') ?? null
  let currentStreak: { days: number; goalTitle: string } | null = null

  if (activeChallenge) {
    const activeGoals = userGoals.filter(g => g.challenge_id === activeChallenge.id)
    let maxDays = 0
    let maxTitle = ''
    for (const goal of activeGoals) {
      const goalCheckIns = userCheckIns.filter(c => c.goal_id === goal.id)
      const days = getCurrentStreak(goal, goalCheckIns, today)
      if (days > maxDays) {
        maxDays = days
        maxTitle = goal.title
      }
    }
    if (maxDays > 0) currentStreak = { days: maxDays, goalTitle: maxTitle }
  }

  const stats: ProfileStats = {
    totalChallenges: completedChallenges.length,
    wins,
    losses,
    ties,
    bestStreak,
    currentStreak,
    totalCheckIns,
  }

  const avatarUrl = getAvatarUrl(user.id, profile.avatar_style)

  return (
    <ProfileClient
      profile={profile}
      activeChallenge={activeChallenge}
      challenges={challenges}
      allGoals={allGoals}
      allCheckIns={allCheckIns}
      stats={stats}
      avatarUrl={avatarUrl}
      userId={user.id}
    />
  )
}
```

- [ ] **Step 2: Replace `components/profile/ProfileClient.tsx`** with stats tiles wired up

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, ChallengeWithProfiles, Goal, CheckIn } from '@/types/database'
import { getAvatarUrl } from '@/lib/avatar'
import AvatarPicker from './AvatarPicker'
import StatTile from './StatTile'
import StreakDetailSheet from './StreakDetailSheet'
import type { ProfileStats } from '@/app/profile/page'

interface Props {
  profile: Profile
  activeChallenge: ChallengeWithProfiles | null
  challenges: ChallengeWithProfiles[]
  allGoals: Goal[]
  allCheckIns: CheckIn[]
  stats: ProfileStats
  avatarUrl: string
  userId: string
}

export default function ProfileClient({
  profile, activeChallenge, challenges, allGoals, allCheckIns, stats, userId,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [avatarStyle, setAvatarStyle] = useState(profile.avatar_style)
  const [showPicker, setShowPicker] = useState(false)
  const [showStreakSheet, setShowStreakSheet] = useState(false)
  const [showWinBreakdown, setShowWinBreakdown] = useState(false)

  const avatarUrl = getAvatarUrl(userId, avatarStyle)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const activeLine = activeChallenge
    ? (() => {
        const start = new Date(activeChallenge.start_date)
        const today = new Date()
        const dayNumber = Math.max(
          1,
          Math.floor((today.getTime() - start.getTime()) / 86400000) + 1
        )
        const totalDays = Math.floor(
          (new Date(activeChallenge.end_date).getTime() - start.getTime()) / 86400000
        ) + 1
        return `Day ${dayNumber} of ${totalDays} · ${activeChallenge.month_name}`
      })()
    : 'No active challenge'

  const total = stats.wins + stats.losses + stats.ties
  const winRateDisplay = total === 0 ? '—' : `${Math.round((stats.wins / total) * 100)}%`

  const streakSubtitle = stats.bestStreak
    ? `${stats.bestStreak.goalTitle.slice(0, 12)} · ${stats.bestStreak.buddyName.split(' ')[0]}`
    : undefined

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-100 shadow-sm hover:opacity-80 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          aria-label="Change avatar"
        >
          <img src={avatarUrl} alt="Your avatar" width={96} height={96} className="w-full h-full object-cover" />
        </button>
        <h1 className="text-xl font-black text-gray-800">{profile.name}</h1>
        <p className="text-sm text-gray-400 font-semibold">{activeLine}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {/* Tile 1: Challenges */}
        <StatTile
          value={String(stats.totalChallenges || '—')}
          label="challenges"
        />

        {/* Tile 2: Win Rate */}
        <StatTile
          value={winRateDisplay}
          label="win rate"
          onClick={() => setShowWinBreakdown(v => !v)}
        >
          {showWinBreakdown && total > 0 && (
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-center col-span-1">
              <div className="flex justify-around text-xs font-bold">
                <span className="text-teal-500">{stats.wins}W</span>
                <span className="text-red-400">{stats.losses}L</span>
                <span className="text-gray-400">{stats.ties}T</span>
              </div>
            </div>
          )}
        </StatTile>

        {/* Tile 3: Best Streak */}
        <StatTile
          value={stats.bestStreak ? `🔥${stats.bestStreak.days}` : '—'}
          label="best streak"
          subtitle={streakSubtitle}
          onClick={stats.bestStreak ? () => setShowStreakSheet(true) : undefined}
        />

        {/* Tile 4: Check-ins */}
        <StatTile
          value={String(stats.totalCheckIns || '—')}
          label="check-ins"
        />
      </div>

      {/* History placeholder */}
      <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-3">
        Challenge History
      </p>
      <div className="rounded-2xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
        Loading history…
      </div>

      {/* Sign out */}
      <div className="mt-12 flex justify-center">
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-400 font-semibold hover:text-gray-600 transition"
        >
          Sign out
        </button>
      </div>

      {/* Sheets */}
      {showPicker && (
        <AvatarPicker
          userId={userId}
          currentStyle={avatarStyle}
          onStyleChange={setAvatarStyle}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showStreakSheet && stats.bestStreak && (
        <StreakDetailSheet
          best={stats.bestStreak}
          current={stats.currentStreak}
          onClose={() => setShowStreakSheet(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Test manually**

```bash
npm run dev
```

Navigate to `/profile`. Verify:
- All 4 stat tiles show real values (not skeleton)
- Win Rate tile toggles W/L/T breakdown on tap
- Best Streak tile opens StreakDetailSheet on tap
- StreakDetailSheet shows best streak, mini calendar, and current streak with "X days away from best" (or "New personal best!" if applicable)
- If user has no completed challenges, tiles show `—`

- [ ] **Step 5: Commit**

```bash
git add app/profile/page.tsx components/profile/ProfileClient.tsx
git commit -m "feat: stats tiles with win rate, best streak, check-ins computed server-side"
```

---

## BATCH E — History

### Task 11: ChallengeHistoryCard Component

**Files:**
- Create: `components/profile/ChallengeHistoryCard.tsx`

- [ ] **Step 1: Create `components/profile/ChallengeHistoryCard.tsx`**

```tsx
import Link from 'next/link'
import { BRAND_GRADIENT } from '@/lib/brand'

type ResultBadge = 'win' | 'loss' | 'tie' | 'in-progress'

interface Props {
  challengeId: string
  name: string
  dateRange: string       // "Jan 1 – Jan 30, 2025"
  buddyName: string
  myScore: number         // 0-100
  buddyScore: number      // 0-100
  result: ResultBadge
}

const BADGE: Record<ResultBadge, { label: string; className: string; style?: React.CSSProperties }> = {
  win:         { label: '✓ Win',       className: 'bg-teal-100 text-teal-700' },
  loss:        { label: '✗ Loss',      className: 'bg-red-100 text-red-500' },
  tie:         { label: '= Tie',       className: 'bg-gray-100 text-gray-500' },
  'in-progress': { label: 'In Progress', className: 'text-white', style: { background: BRAND_GRADIENT } },
}

export default function ChallengeHistoryCard({
  challengeId, name, dateRange, buddyName, myScore, buddyScore, result,
}: Props) {
  const badge = BADGE[result]

  return (
    <Link
      href={result === 'in-progress' ? '/wrap-up' : `/wrap-up?challenge=${challengeId}`}
      className="block rounded-2xl bg-gray-50 px-4 py-3 mb-3 hover:bg-gray-100 transition active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-black text-gray-800 text-sm truncate">{name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{dateRange}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            vs {buddyName} · <span className="font-semibold text-gray-600">{myScore}%</span>
            {' '}vs <span className="font-semibold text-gray-500">{buddyScore}%</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`text-xs font-black px-2 py-1 rounded-full ${badge.className}`}
            style={badge.style}
          >
            {badge.label}
          </span>
          <span className="text-gray-300 font-bold">›</span>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/profile/ChallengeHistoryCard.tsx
git commit -m "feat: ChallengeHistoryCard with win/loss/tie/in-progress badge"
```

---

### Task 12: Challenge History List in ProfileClient

**Files:**
- Modify: `components/profile/ProfileClient.tsx`

- [ ] **Step 1: Replace `components/profile/ProfileClient.tsx`** with challenge history wired up

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, ChallengeWithProfiles, Goal, CheckIn } from '@/types/database'
import { getAvatarUrl } from '@/lib/avatar'
import { scoreChallenge } from '@/lib/scoring'
import AvatarPicker from './AvatarPicker'
import StatTile from './StatTile'
import StreakDetailSheet from './StreakDetailSheet'
import ChallengeHistoryCard from './ChallengeHistoryCard'
import type { ProfileStats } from '@/app/profile/page'

interface Props {
  profile: Profile
  activeChallenge: ChallengeWithProfiles | null
  challenges: ChallengeWithProfiles[]
  allGoals: Goal[]
  allCheckIns: CheckIn[]
  stats: ProfileStats
  avatarUrl: string
  userId: string
}

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    return new Date(y, m - 1, day).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }
  return `${fmt(start)} – ${fmt(end)}`
}

export default function ProfileClient({
  profile, activeChallenge, challenges, allGoals, allCheckIns, stats, userId,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [avatarStyle, setAvatarStyle] = useState(profile.avatar_style)
  const [showPicker, setShowPicker] = useState(false)
  const [showStreakSheet, setShowStreakSheet] = useState(false)
  const [showWinBreakdown, setShowWinBreakdown] = useState(false)

  const avatarUrl = getAvatarUrl(userId, avatarStyle)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const activeLine = activeChallenge
    ? (() => {
        const start = new Date(activeChallenge.start_date)
        const today = new Date()
        const dayNumber = Math.max(
          1,
          Math.floor((today.getTime() - start.getTime()) / 86400000) + 1
        )
        const totalDays = Math.floor(
          (new Date(activeChallenge.end_date).getTime() - start.getTime()) / 86400000
        ) + 1
        return `Day ${dayNumber} of ${totalDays} · ${activeChallenge.month_name}`
      })()
    : 'No active challenge'

  const total = stats.wins + stats.losses + stats.ties
  const winRateDisplay = total === 0 ? '—' : `${Math.round((stats.wins / total) * 100)}%`
  const streakSubtitle = stats.bestStreak
    ? `${stats.bestStreak.goalTitle.slice(0, 12)} · ${stats.bestStreak.buddyName.split(' ')[0]}`
    : undefined

  // Build challenge history rows (most recent first — already ordered from RSC)
  const historyRows = challenges.map(challenge => {
    const buddyId = challenge.creator_id === userId ? challenge.buddy_id : challenge.creator_id
    const buddyProfile = challenge.creator_id === userId ? challenge.buddy : challenge.creator
    const buddyName = buddyProfile?.name ?? 'Buddy'

    const myGoals = allGoals.filter(g => g.challenge_id === challenge.id && g.user_id === userId)
    const buddyGoals = allGoals.filter(g => g.challenge_id === challenge.id && g.user_id === buddyId)
    const myCheckIns = allCheckIns.filter(c => c.user_id === userId && myGoals.some(g => g.id === c.goal_id))
    const buddyCheckIns = allCheckIns.filter(c => c.user_id === buddyId && buddyGoals.some(g => g.id === c.goal_id))

    const totalDays = Math.floor(
      (new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / 86400000
    ) + 1

    const myScore = scoreChallenge(myGoals, myCheckIns, totalDays, challenge.start_date, challenge.end_date, true)
    const buddyScore = scoreChallenge(buddyGoals, buddyCheckIns, totalDays, challenge.start_date, challenge.end_date, true)

    let result: 'win' | 'loss' | 'tie' | 'in-progress'
    if (challenge.status === 'active') result = 'in-progress'
    else if (myScore > buddyScore) result = 'win'
    else if (myScore < buddyScore) result = 'loss'
    else result = 'tie'

    return {
      challengeId: challenge.id,
      name: challenge.month_name,
      dateRange: formatDateRange(challenge.start_date, challenge.end_date),
      buddyName,
      myScore,
      buddyScore,
      result,
    }
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-100 shadow-sm hover:opacity-80 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          aria-label="Change avatar"
        >
          <img src={avatarUrl} alt="Your avatar" width={96} height={96} className="w-full h-full object-cover" />
        </button>
        <h1 className="text-xl font-black text-gray-800">{profile.name}</h1>
        <p className="text-sm text-gray-400 font-semibold">{activeLine}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatTile value={String(stats.totalChallenges || '—')} label="challenges" />

        <StatTile
          value={winRateDisplay}
          label="win rate"
          onClick={() => setShowWinBreakdown(v => !v)}
        >
          {showWinBreakdown && total > 0 && (
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-center">
              <div className="flex justify-around text-xs font-bold">
                <span className="text-teal-500">{stats.wins}W</span>
                <span className="text-red-400">{stats.losses}L</span>
                <span className="text-gray-400">{stats.ties}T</span>
              </div>
            </div>
          )}
        </StatTile>

        <StatTile
          value={stats.bestStreak ? `🔥${stats.bestStreak.days}` : '—'}
          label="best streak"
          subtitle={streakSubtitle}
          onClick={stats.bestStreak ? () => setShowStreakSheet(true) : undefined}
        />

        <StatTile value={String(stats.totalCheckIns || '—')} label="check-ins" />
      </div>

      {/* Challenge History */}
      <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-3">
        Challenge History
      </p>

      {historyRows.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
          No challenges yet
        </div>
      ) : (
        historyRows.map(row => (
          <ChallengeHistoryCard key={row.challengeId} {...row} />
        ))
      )}

      {/* Sign out */}
      <div className="mt-12 flex justify-center">
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-400 font-semibold hover:text-gray-600 transition"
        >
          Sign out
        </button>
      </div>

      {/* Sheets */}
      {showPicker && (
        <AvatarPicker
          userId={userId}
          currentStyle={avatarStyle}
          onStyleChange={setAvatarStyle}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showStreakSheet && stats.bestStreak && (
        <StreakDetailSheet
          best={stats.bestStreak}
          current={stats.currentStreak}
          onClose={() => setShowStreakSheet(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Test manually**

```bash
npm run dev
```

Navigate to `/profile`. Verify:
- Challenge history list renders below stats tiles, most recent first
- Active challenge (if any) shows at the top with gradient "In Progress" badge
- Completed challenges show Win/Loss/Tie badge with correct scores
- Tapping any completed challenge card navigates to `/wrap-up?challenge=<id>`
- Tapping "In Progress" card navigates to `/wrap-up` (no param)
- Empty state shows "No challenges yet" if user has no challenges

- [ ] **Step 4: Commit**

```bash
git add components/profile/ProfileClient.tsx components/profile/ChallengeHistoryCard.tsx
git commit -m "feat: challenge history list with win/loss/tie/in-progress cards"
```

---

### Task 13: Wrap-up History Mode

**Files:**
- Modify: `app/wrap-up/page.tsx`
- Modify: `components/wrap-up/ScoreSummary.tsx`

- [ ] **Step 1: Update `components/wrap-up/ScoreSummary.tsx`** to accept `isHistorical` and `backHref` props

Add two new optional props to the `Props` interface and wire them up. Replace the entire file:

```tsx
'use client'

import { useState } from 'react'
import type { Goal, CheckIn, Profile, GoalChangeRequest } from '@/types/database'
import { scoreChallenge, scoreGoal, getCurrentStreak } from '@/lib/scoring'
import Link from 'next/link'
import PendingApprovalBanner from './PendingApprovalBanner'
import GoalCalendarSheet from '@/components/shared/GoalCalendarSheet'
import ScoreTileGrid from '@/components/shared/ScoreTileGrid'
import GoalPairGrid from '@/components/shared/GoalPairGrid'
import { BRAND_GRADIENT, BRAND_GRADIENT_H } from '@/lib/brand'

// ── Types ─────────────────────────────────────────────────────────────────────
type SheetTarget = { goal: Goal; checkIns: CheckIn[]; isOwn: boolean }

// ── Module-level sub-components ───────────────────────────────────────────────
interface SummaryGoalCardProps {
  goal: Goal
  checkIns: CheckIn[]
  isOwn: boolean
  totalDays: number
  startDate: string
  today: string
  pendingRequests: GoalChangeRequest[]
  onOpen: (target: SheetTarget) => void
  isHistorical: boolean
}

function SummaryGoalCard({
  goal, checkIns, isOwn, totalDays, startDate, today, pendingRequests, onOpen, isHistorical,
}: SummaryGoalCardProps) {
  const pct = Math.round(scoreGoal(goal, checkIns, totalDays, startDate, today, true) * 100)
  const isPending = !isHistorical && isOwn && pendingRequests.some(r => r.goal_id === goal.id)
  const streak = getCurrentStreak(goal, checkIns, today)
  const complete = pct === 100 && !isPending
  const showBar = goal.type !== 'milestone'
  const label = goal.type === 'milestone' ? (complete ? '✓ Done' : 'Not yet') : `${pct}%`

  return (
    <button
      type="button"
      onClick={() => onOpen({ goal, checkIns, isOwn })}
      className={[
        'w-full text-left rounded-xl px-4 py-3 transition active:scale-95 hover:opacity-90',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
        isPending ? 'opacity-60 bg-gray-50 text-gray-400' : complete ? 'text-white' : 'bg-gray-50 text-gray-700',
      ].join(' ')}
      style={complete ? { background: BRAND_GRADIENT } : {}}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold flex-1 leading-tight">
          {goal.title}{isPending && <span className="ml-1 text-xs">⏳</span>}
        </span>
        <span className={`text-xs font-black flex-shrink-0 ${complete ? 'text-white/80' : 'text-teal-600'}`}>
          {label}
        </span>
      </div>

      {showBar && (
        <div className={`mt-2 h-1 rounded-full overflow-hidden ${complete ? 'bg-white/30' : 'bg-gray-200'}`}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: complete ? 'rgba(255,255,255,0.7)' : BRAND_GRADIENT_H,
            }}
          />
        </div>
      )}

      {streak >= 2 && (
        <p className={`text-xs font-bold mt-2 ${complete ? 'text-white/70' : 'text-orange-400'}`}>🔥{streak}</p>
      )}
    </button>
  )
}

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
  startDate: string
  endDate: string
  today: string
  challengeId: string
  myId: string
  pendingRequests: GoalChangeRequest[]
  isHistorical?: boolean   // hides edit buttons, pending, CTA
  backHref?: string        // shows ← Back link when set
}

export default function ScoreSummary({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myProfile, buddyProfile, totalDays, challengeName, isComplete,
  startDate, endDate, today, challengeId, myId, pendingRequests,
  isHistorical = false,
  backHref,
}: Props) {
  const myScore = scoreChallenge(myGoals, myCheckIns, totalDays, startDate, today, true)
  const buddyScore = scoreChallenge(buddyGoals, buddyCheckIns, totalDays, startDate, today, true)
  const iWon = myScore > buddyScore
  const tied = myScore === buddyScore
  const bothPerfect = myScore === 100 && buddyScore === 100

  const myDailyGoals = myGoals.filter(g => g.type === 'daily')
  const buddyDailyGoals = buddyGoals.filter(g => g.type === 'daily')
  const myTargetGoals = myGoals.filter(g => g.type === 'frequency' || g.type === 'cumulative')
  const buddyTargetGoals = buddyGoals.filter(g => g.type === 'frequency' || g.type === 'cumulative')
  const myMilestoneGoals = myGoals.filter(g => g.type === 'milestone')
  const buddyMilestoneGoals = buddyGoals.filter(g => g.type === 'milestone')

  const [sheet, setSheet] = useState<SheetTarget | null>(null)

  const myDaysActive = new Set(myCheckIns.filter(c => c.completed).map(c => c.date)).size
  const buddyDaysActive = new Set(buddyCheckIns.filter(c => c.completed).map(c => c.date)).size

  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const dayNumber = Math.max(1, Math.floor(
    (new Date(ty, tm - 1, td).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86400000
  ) + 1)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Back link — only shown in historical mode */}
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm font-semibold text-gray-400 hover:text-gray-600 transition mb-4"
        >
          ← Back to profile
        </Link>
      )}

      {/* Slim teal strip */}
      <div
        className="rounded-2xl px-5 py-3 mb-4 text-white text-center"
        style={{ background: BRAND_GRADIENT }}
      >
        <p className="font-black text-base">{challengeName}</p>
        <p className="text-white/70 text-xs font-semibold mt-0.5">
          Day {dayNumber} of {totalDays} · {isComplete ? 'Final Results' : 'Summary'}
        </p>
      </div>

      <ScoreTileGrid
        left={{
          name: myProfile?.name ?? 'Me',
          mainValue: `${myScore}%`,
          subLabel: `${myDaysActive}/${totalDays} days active`,
          isWinner: !tied && iWon,
        }}
        right={{
          name: buddyProfile?.name ?? 'Buddy',
          mainValue: `${buddyScore}%`,
          subLabel: `${buddyDaysActive}/${totalDays} days active`,
          isWinner: !tied && !iWon,
        }}
        tied={tied}
        bothPerfect={bothPerfect}
      />

      {/* Pending banner — hidden in historical mode */}
      {!isHistorical && (
        <PendingApprovalBanner
          requests={pendingRequests}
          goals={[...myGoals, ...buddyGoals]}
          myId={myId}
        />
      )}

      <div className="space-y-6">
        {(myDailyGoals.length > 0 || buddyDailyGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Daily Goals</p>
            <GoalPairGrid
              myColumn={myDailyGoals.map(goal => (
                <SummaryGoalCard key={goal.id} goal={goal} checkIns={myCheckIns} isOwn={true}
                  totalDays={totalDays} startDate={startDate} today={today}
                  pendingRequests={pendingRequests} onOpen={setSheet} isHistorical={isHistorical} />
              ))}
              buddyColumn={buddyDailyGoals.map(goal => (
                <SummaryGoalCard key={goal.id} goal={goal} checkIns={buddyCheckIns} isOwn={false}
                  totalDays={totalDays} startDate={startDate} today={today}
                  pendingRequests={pendingRequests} onOpen={setSheet} isHistorical={isHistorical} />
              ))}
            />
          </div>
        )}

        {(myTargetGoals.length > 0 || buddyTargetGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Ongoing</p>
            <GoalPairGrid
              myColumn={myTargetGoals.map(goal => (
                <SummaryGoalCard key={goal.id} goal={goal} checkIns={myCheckIns} isOwn={true}
                  totalDays={totalDays} startDate={startDate} today={today}
                  pendingRequests={pendingRequests} onOpen={setSheet} isHistorical={isHistorical} />
              ))}
              buddyColumn={buddyTargetGoals.map(goal => (
                <SummaryGoalCard key={goal.id} goal={goal} checkIns={buddyCheckIns} isOwn={false}
                  totalDays={totalDays} startDate={startDate} today={today}
                  pendingRequests={pendingRequests} onOpen={setSheet} isHistorical={isHistorical} />
              ))}
            />
          </div>
        )}

        {(myMilestoneGoals.length > 0 || buddyMilestoneGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Milestones</p>
            <GoalPairGrid
              myColumn={myMilestoneGoals.map(goal => (
                <SummaryGoalCard key={goal.id} goal={goal} checkIns={myCheckIns} isOwn={true}
                  totalDays={totalDays} startDate={startDate} today={today}
                  pendingRequests={pendingRequests} onOpen={setSheet} isHistorical={isHistorical} />
              ))}
              buddyColumn={buddyMilestoneGoals.map(goal => (
                <SummaryGoalCard key={goal.id} goal={goal} checkIns={buddyCheckIns} isOwn={false}
                  totalDays={totalDays} startDate={startDate} today={today}
                  pendingRequests={pendingRequests} onOpen={setSheet} isHistorical={isHistorical} />
              ))}
            />
          </div>
        )}
      </div>

      {/* CTA — hidden in historical mode */}
      {isComplete && !isHistorical && (
        <Link
          href="/dashboard"
          className="block w-full text-center py-3 rounded-xl font-bold text-sm mt-6"
          style={{ background: BRAND_GRADIENT, color: 'white' }}
        >
          Start a new challenge →
        </Link>
      )}

      {sheet && (
        <GoalCalendarSheet
          goal={sheet.goal}
          checkIns={sheet.checkIns}
          isOwn={sheet.isOwn}
          isPending={!isHistorical && sheet.isOwn && pendingRequests.some(r => r.goal_id === sheet.goal.id)}
          startDate={startDate}
          endDate={endDate}
          today={today}
          challengeId={challengeId}
          myId={myId}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `app/wrap-up/page.tsx`** to accept optional `?challenge=<id>` search param

Replace the entire file:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ScoreSummary from '@/components/wrap-up/ScoreSummary'
import type { ChallengeWithProfiles, Profile } from '@/types/database'

interface Props {
  searchParams: Promise<{ challenge?: string }>
}

export default async function WrapUpPage({ searchParams }: Props) {
  const { challenge: challengeId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // If a specific challenge ID is provided, load that challenge.
  // Otherwise, load the most recent active/completed challenge.
  let challenge: ChallengeWithProfiles | null = null

  if (challengeId) {
    const { data } = await supabase
      .from('challenge_months')
      .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
      .eq('id', challengeId)
      .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
      .single()
    challenge = (data ?? null) as ChallengeWithProfiles | null
  } else {
    const { data } = await supabase
      .from('challenge_months')
      .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
      .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
      .in('status', ['active', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    challenge = (data ?? null) as ChallengeWithProfiles | null
  }

  if (!challenge) redirect('/dashboard')

  const buddyId = challenge.creator_id === user.id
    ? challenge.buddy_id
    : challenge.creator_id

  if (!buddyId) redirect('/dashboard')

  const totalDays = Math.floor(
    (new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / 86400000
  ) + 1
  const today = new Date().toISOString().split('T')[0]

  const [goalsRes, myCheckInsRes, buddyCheckInsRes, myProfileRes, pendingRes] = await Promise.all([
    supabase.from('goals').select('*').eq('challenge_id', challenge.id),
    supabase.from('check_ins').select('*').eq('user_id', user.id)
      .gte('date', challenge.start_date)
      .lte('date', challenge.end_date),
    supabase.from('check_ins').select('*').eq('user_id', buddyId)
      .gte('date', challenge.start_date)
      .lte('date', challenge.end_date),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('goal_change_requests').select('*')
      .eq('challenge_id', challenge.id).eq('status', 'pending'),
  ])

  if (!myProfileRes.data) redirect('/auth/login')

  const allGoals = goalsRes.data ?? []
  const buddyProfile = (challenge.creator_id === user.id
    ? challenge.buddy
    : challenge.creator) as Profile | null

  // Historical mode: viewing a past challenge from profile page
  const isHistorical = !!challengeId

  return (
    <ScoreSummary
      myGoals={allGoals.filter(g => g.user_id === user.id)}
      buddyGoals={allGoals.filter(g => g.user_id === buddyId)}
      myCheckIns={myCheckInsRes.data ?? []}
      buddyCheckIns={buddyCheckInsRes.data ?? []}
      myProfile={myProfileRes.data}
      buddyProfile={buddyProfile}
      totalDays={totalDays}
      challengeName={challenge.month_name}
      isComplete={challenge.status === 'completed'}
      startDate={challenge.start_date}
      endDate={challenge.end_date}
      today={today}
      challengeId={challenge.id}
      myId={user.id}
      pendingRequests={isHistorical ? [] : (pendingRes.data ?? [])}
      isHistorical={isHistorical}
      backHref={isHistorical ? '/profile' : undefined}
    />
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Test manually**

```bash
npm run dev
```

Test both paths:

**Existing wrap-up (must not regress):**
- Navigate to `/wrap-up` — loads current/most recent challenge
- "Start a new challenge →" CTA is visible (if challenge is complete)
- Pending approval banner is visible
- No "← Back to profile" link

**Historical wrap-up:**
- Navigate to `/profile`
- Tap a completed challenge history card
- URL becomes `/wrap-up?challenge=<id>`
- "← Back to profile" link appears at top
- "Start a new challenge →" CTA is **hidden**
- Pending approval banner is **hidden**
- Goal cards are still tappable (open GoalCalendarSheet for historical viewing)

- [ ] **Step 5: Run all tests**

```bash
npm test -- --no-coverage
```

Expected: all existing tests pass. No regressions.

- [ ] **Step 6: Commit**

```bash
git add app/wrap-up/page.tsx components/wrap-up/ScoreSummary.tsx
git commit -m "feat: wrap-up history mode with ?challenge=<id> param and back-to-profile link"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
npm test -- --no-coverage
```

Expected: all tests pass.

- [ ] **TypeScript clean**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **End-to-end smoke test**

With `npm run dev` running, verify the full user journey:

1. Sign in → navbar shows avatar circle in top-right
2. Click avatar → navigates to `/profile`
3. Profile shows: avatar, name, active challenge line, 4 stat tiles, challenge history, sign-out
4. Tap avatar → AvatarPicker opens with 30 style previews
5. Select a style → avatar updates instantly (optimistic), picker closes
6. Navbar avatar updates on next page navigation
7. Tap "win rate" tile → W/L/T breakdown appears inline
8. Tap "best streak" tile → StreakDetailSheet opens with mini calendar and current vs best comparison
9. Tap a completed challenge card → navigates to `/wrap-up?challenge=<id>` with "← Back to profile" shown
10. On historical wrap-up: no CTA, no pending banner, "← Back to profile" works
11. Tap "In Progress" card → navigates to `/wrap-up` (current challenge, normal mode)
12. Sign out from profile page → redirects to `/`

- [ ] **Final commit**

```bash
git add -p   # review all unstaged changes
git commit -m "feat: complete profile page — avatar picker, stats, challenge history, historical wrap-up"
```
