# Missed Goals on Today Tab — Design Spec

**Date:** 2026-05-07
**Status:** Approved for implementation

---

## Problem

When a user misses a daily or scheduled frequency goal, it silently disappears. The Today tab has no record of the miss, and the user only discovers it by browsing the GoalCalendarSheet. This undermines accountability — the core purpose of the app.

## Solution

Inject missed goal tiles into the existing **Today's Goals** section. Each tile is visually distinct (pink/red) with an "X days late" label. Tapping opens `GoalCalendarSheet` so the user can log the missed day belatedly or acknowledge the miss.

---

## Behaviour

### What counts as "missed"

A goal is missed if it had at least one **scheduled past day** (before today, within the last 7 days or since challenge start, whichever is more recent) with no completed check-in.

| Goal type | Scheduled days | Missed when |
|-----------|---------------|-------------|
| `daily` | Every calendar day in the challenge | Any past day (up to 7-day lookback) has no completed check-in |
| `frequency` | Entries in `schedule_dates` | Any `schedule_date` < today (up to 7-day lookback) has no completed check-in |
| `cumulative` | N/A | Never shown as missed |
| `milestone` | N/A | Never shown as missed |

### One missed tile per goal

If a goal has 3 missed days it still gets **one missed tile** showing "3 days late". This prevents the section from becoming a wall of tiles.

### Placement

Missed tiles appear at the **top** of the Today's Goals section, above today's pending/completed goals.

If a daily goal is missed (has past missed days) AND is also due today, it gets **both** a pink missed tile at the top AND its regular today tile below. These are independent: the missed tile is for past days (open the calendar, log them), the regular tile is for today (tap to toggle). The user handles each separately.

### For buddy goals

Missed buddy goal tiles are shown in the buddy column, read-only (no toggle). Tapping opens the calendar in read-only mode (existing `isOwn=false` behaviour).

### Disappears when resolved

Once all missed days for a goal are checked off (via the calendar sheet), the missed tile disappears. Achieved via optimistic state — the tile re-evaluates when check-ins change.

---

## New Component: `MissedGoalCard`

**File:** `components/dashboard/MissedGoalCard.tsx`

**Props:**
```ts
interface Props {
  goal: Goal
  checkIns: CheckIn[]
  missedDays: number       // pre-computed by caller
  isMyGoal: boolean
  today: string
  startDate: string
  endDate: string
  challengeId: string
  myId: string
}
```

**Appearance:**
- Pink background (`#fff1f2`), red border (`1.5px solid #fca5a5`)
- Red text (`text-red-600`)
- Goal title on left
- `"X day late"` / `"X days late"` badge on right (red, bold)
- Full-width tappable button → opens `GoalCalendarSheet`
- Active scale-95 press feedback

---

## New Scoring Function: `getMissedDays`

**File:** `lib/scoring.ts` (append)

```ts
export function getMissedDays(
  goal: Goal,
  checkIns: CheckIn[],
  today: string,
  challengeStart: string,
): number
```

- Only handles `daily` and `frequency` goals; returns `0` for others.
- Lookback window: `max(challengeStart, 7 days before today)` up to `yesterday`.
- For `daily`: counts calendar days in window with no completed check-in.
- For `frequency`: counts `schedule_dates` entries in window with no completed check-in.
- Returns count of missed days (0 = nothing to show).

---

## Changes to `DashboardClient`

1. Import `getMissedDays` and `MissedGoalCard`.
2. Import `GoalCalendarSheet` and add `sheet` state (`{ goal, checkIns, isOwn } | null`).
3. Compute missed counts for each goal:
   ```ts
   function missedDays(goal: Goal, checkIns: CheckIn[]) {
     return getMissedDays(goal, checkIns, today, challenge.start_date)
   }
   ```
4. In Today's Goals `GoalPairGrid`, prepend missed tiles before regular today tiles:
   ```tsx
   myColumn={[
     ...myTodayGoals
       .filter(g => missedDays(g, optimisticCheckIns) > 0)
       .map(g => <MissedGoalCard ... />),
     ...myTodayGoals.map(g => <GoalCard ... />),
   ]}
   ```
5. Pass `startDate` and `endDate` (from `challenge`) as props to `DashboardClient` (they are available in `challenge` already — just need destructuring).

---

## Data Requirements

No schema changes. All required data is already fetched:
- `myCheckIns` and `buddyCheckIns` — full challenge period
- `challenge.start_date` and `challenge.end_date` — on the challenge object

`DashboardClient` already receives `challenge` as a prop, so `start_date` and `end_date` are accessible.

---

## Edge Cases

| Case | Behaviour |
|------|-----------|
| Challenge started today | No lookback window → no missed tiles |
| All missed days logged via calendar | `getMissedDays` returns 0 → tile disappears |
| Buddy has no goals | No missed tiles in buddy column |
| Goal added mid-challenge | Only missed days since goal was created count (naturally, as `checkIns` only go back to creation) |
| 7+ days of misses | Shows "7 days late" (capped at lookback window) |

---

## Testing

- `getMissedDays` — unit tests in `lib/__tests__/scoring.test.ts`
  - daily goal, 2 missed days in window → returns 2
  - daily goal, all done → returns 0
  - frequency goal, 1 of 3 schedule_dates missed → returns 1
  - cumulative goal → returns 0
  - challenge started today → returns 0
  - missed day outside 7-day window → not counted
