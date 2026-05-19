# Week Tab Redesign — Design Spec

**Date:** 2026-05-17
**Status:** Awaiting user review before implementation plan
**Scope:** Complete redesign of the "This Week" tab (`/week`)

---

## 1. Purpose

The Week tab currently shows a single day at a time with prev/next arrow navigation, effectively reproducing the Today tab for other days. This redesign repositions the Week tab to do a fundamentally different job:

**Today tab** answers: *"What do I do right now?"*
**Week tab** answers: *"How has my week gone, and where can I catch up?"*

The headline value becomes **weekly pattern recognition** ("I dropped off mid-week"), supported by **day drill-down** for catch-up and per-day detail.

## 2. Success criteria

A user opening the Week tab can:

1. See, at a glance and within 1 second, how their week has gone — and how their buddy's has — across all 7 days.
2. Compare their pattern visually against their buddy's (which days were strong, which were weak).
3. Tap any day in the current week to see the goals scheduled for it and (within the 24-hour grace window) toggle check-ins for that day directly, with one tap.
4. Navigate to past weeks of the challenge to review historical performance (read-only).
5. Read the week-to-date bottom-line scores at a glance.

A user **cannot**:

- Edit any check-in older than yesterday (24-hour grace window enforced).
- Edit past weeks.
- See future weeks beyond the current one (no preview of upcoming weeks).

## 3. Layout (top to bottom)

```
┌─────────────────────────────────────┐
│  ‹    MAY 13 – 19    ›              │ ← Week header
├─────────────────────────────────────┤
│  M  T  W  T  F  S  S                │
│  You  ● ● ◐ ◯ ◯ ⌐ ⌐                │ ← Week strip (you)
│  Josh ◐ ● ● ● ◐ ⌐ ⌐                │ ← Week strip (buddy)
├─────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────────┐ │
│ │ You         │ │ Josh ⚡ AHEAD   │ │
│ │ 40%         │ │ 60%             │ │ ← Score tiles
│ │ week so far │ │ week so far     │ │
│ └─────────────┘ └─────────────────┘ │
├─────────────────────────────────────┤
│  WEDNESDAY · MAY 15                 │ ← Day-detail label
│                                     │
│  Daily Goals                        │
│  ┌──────────┐ ┌──────────┐          │
│  │ ○ Wake up│ │ ✓ Wake up│          │
│  └──────────┘ └──────────┘          │
│                                     │
│  Ongoing                            │
│  …                                  │
│                                     │
│  Milestones                         │
│  …                                  │
└─────────────────────────────────────┘
```

## 4. Components

### 4.1 Week header

- Centered text label: the week's date range, formatted as `MONTH DD – DD` (e.g., *"MAY 13 - 19"*). Style: small caps, gray-600, font-bold, letter-spacing wide.
- Left arrow `‹` and right arrow `›`, small buttons (~32×32px), positioned on either side of the date label.
- **Left arrow:** navigates to previous week. Disabled when at week 1 of the challenge (`weekStart === firstWeekOfChallenge`).
- **Right arrow:** navigates to next week. Disabled when at the current week (no future-week browsing).
- Both arrows: tap-feedback via `active:scale-95 transition` like other CTAs.
- This replaces the existing teal brand-coloured banner with prev/next *day* arrows. The day-navigation function moves into the strip below.

### 4.2 Week strip

The visual headline of the tab. Two stacked rows of dots representing 7 days each.

**Structure:**

```
[name-label]  M  T  W  T  F  S  S
[You]         ●  ●  ◐  ◯  ◯  ⌐  ⌐
[Josh]        ◐  ●  ●  ●  ◐  ⌐  ⌐
```

- Day labels (`M T W T F S S`) rendered once, above the dot rows.
- Two rows of dots: yours (top) labelled with `"You"`; buddy's (bottom) labelled with their name (truncated if needed).
- Name labels are left-aligned, small font, fixed-width (~56px).
- Dot row stretches to fill remaining horizontal space, with 7 equal cells.

**Dot states:**

| State | Visual | When |
|---|---|---|
| **Full** | Solid teal circle (`#00C9A7`) | All scheduled goals for that day are completed (and there is at least one scheduled goal) |
| **Partial** | Half-filled teal circle (conic-gradient or border + half fill) | Some but not all scheduled goals completed |
| **Empty** | Hollow gray-300 circle outline | At least one scheduled goal exists for the day, and none were completed (the day is past or current) |
| **Rest** | Small horizontal gray-300 dash (or hyphen mark, 8×2px) centered in a dot-sized cell | The user has zero scheduled goals for that day — intentionally empty, not a miss |
| **Future** | Dashed gray-300 circle outline | Day is in the future (after today) AND has at least one scheduled goal upcoming. If a future day has zero scheduled goals, render as **rest** instead |
| **Selected** | Any state above + teal `outline 2px outline-offset 2px` | This is the currently selected day |

Dot size: 18×18px (or equivalent footprint for the rest-day dash).

**Per-day "completion" calculation:**

For a given day, compute `scheduled = daily goals + frequency goals with schedule_dates.includes(thatDay)`. Cumulative and milestone goals are NOT factored into the per-day dot (they're not day-specific).

- **`scheduled.length === 0`** → state = `rest` (or `future` if the day is after today AND there are also no future scheduled goals on it).
- **`scheduled.length > 0` AND day is after today** → state = `future`.
- **`scheduled.length > 0` AND day is today or past:**
  - Count `completed = scheduled goals with a completed check-in on that day`.
  - `completed === scheduled.length` → state = `full`.
  - `0 < completed < scheduled.length` → state = `partial`.
  - `completed === 0` → state = `empty`.

**Selection behavior:**

- The entire day cell is tappable (day label + dot area, both rows visually but only one selection state per column).
- Tapping a day cell sets that day as the selected day.
- Default selected day on tab mount:
  - **Current week:** today.
  - **Past week:** Sunday of that week. If Sunday is after the challenge's `end_date`, default to `end_date` instead.

### 4.3 Score tiles

Two side-by-side tiles below the strip showing **week-to-date** totals.

- Tile design: matches existing `ScoreTileGrid` component (BRAND_GRADIENT background, white text, large central number).
- Left tile: your week-to-date score, label `"You"`, sub-label `"week so far"`.
- Right tile: buddy's week-to-date score, label `<buddy name>`, sub-label `"week so far"`.
- Winning side shows `⚡ AHEAD` chip (existing behavior).
- Score does NOT change as the user taps different days in the strip — it's always week-to-date for the *currently viewed week*. When navigated to a past week, score shows the totals as they were *at the end of that week*.

### 4.4 Day-detail section

When a day is selected (via strip tap), this section shows that day's goals.

**Header label:**
*"`DAY_NAME` · `MONTH DD`"* — e.g., *"WEDNESDAY · MAY 15"*. Small caps, gray-400, letter-spacing.

**Body:**
Three sub-sections preserved from current Week tab structure, but filtered to the selected day:

- **Daily Goals**: daily-type goals + frequency goals whose `schedule_dates` includes the selected day.
- **Ongoing**: cumulative goals + frequency goals NOT scheduled for the selected day.
- **Milestones**: milestone-type goals.

Each section uses the same two-column grid pattern (your goals / buddy's goals), matching the Today tab's section structure with white tiles on gray-100 section cards (gray-100 from recent grayscale work).

Empty sections (no goals in that category for that day) show *"Rest day"* placeholder or are hidden — preserve current `renderSection` behavior of hiding entirely when both columns are empty.

### 4.5 Goal tiles in day-detail

Tiles look the same as the Today tab equivalents (same `GoalCard` component, same styling). The only difference is the *behavior on tap*, which depends on edit state.

## 5. Edit behavior

Three edit states, determined by which day is selected and whether the user is on the current week or a past week.

### 5.1 Editable: today (current week)

- Tap a goal tile → toggles check-in for today directly.
- Behavior identical to Today tab's `handleToggle(goalId)` call.
- Optimistic UI update + server action `toggleCheckIn(goalId, today)`.

### 5.2 Editable: yesterday (current week, within 24h grace)

- Tap a goal tile → toggles check-in for yesterday directly.
- Uses existing `useCheckInToggle` hook's optional date parameter: `handleToggle(goalId, yesterdayStr)`.
- This **fixes the known bug** where tapping a goal on the yesterday view currently opens the calendar sheet — instead of recognising the user has already implicitly selected yesterday via navigation.

### 5.3 Read-only: 2+ days ago, or any past week

- Tap a goal tile → press animation (`active:scale-95`) fires for tactile feedback, but no state change occurs.
- No toast, no banner. Silent. Matches existing calendar-sheet behavior for locked dates.
- Tiles render in their current done/not-done state for that historical day, visually unchanged from editable tiles (no greyed-out treatment — the lock is a behavior, not a visual state).

### 5.4 Future days (current week)

- Currently rare for daily goals (always-on) but possible for frequency goals with `schedule_dates` reaching into the future.
- Tap → press animation, no state change. Read-only.
- Tiles show scheduled goals with empty checkboxes (no completion data yet).

## 6. Cross-week navigation

- Initial view: current week (computed from today).
- Tapping `‹` in the week header navigates to previous week of the challenge (`weekStart -= 7 days`).
- Tapping `›` navigates to next week, capped at the current week.
- Constraints:
  - Cannot navigate before `challenge.start_date`'s week.
  - Cannot navigate beyond the current week (no future-week browsing).
- When viewing a past week:
  - Strip shows that week's data (read-only).
  - Score tiles show that week's totals (the "end-of-week" values for completed past weeks).
  - Day-detail section shows the goals for any day tapped, but tiles are read-only (5.3).

## 7. Edge cases

### 7.1 Buddy hasn't joined yet (pending challenge)

- The Week tab should redirect to `/dashboard` if no buddy yet (pending state). Matches current behavior in `app/week/page.tsx`.

### 7.2 Buddy's name is long

- Truncate buddy's name label in the strip to fit (max ~10 chars + ellipsis).
- Use full name in tooltip/aria-label if applicable.

### 7.3 No goals on the selected day (rest day)

A user with only Mon/Wed/Fri frequency goals selecting Saturday has zero scheduled goals that day. This is a rest day — distinct from a miss.

- In the strip: the day's dot renders as the `rest` state (a small dash) per the dot-state table in 4.2.
- In the day-detail section: `renderSection` returns null when both columns are empty (preserve current behavior).
- If ALL three sub-sections are empty, render a centered "Rest day" empty state with a small placeholder. Matches the existing pattern from the Today tab's empty state.

### 7.4 Cumulative goals in day-detail

- Cumulative goals are not day-specific. They appear in the "Ongoing" section.
- The cumulative tile displays the running total *as of the selected day* (i.e., sum of check-in values where `date <= selectedDay`). For the current week, this matches the live total. For past weeks, it shows the total as it stood at the end of that week.
- The tile remains tappable to view progress, but the `+Log` action is only available on today (Today tab) — Week tab's cumulative tiles are read-only references.

### 7.5 Milestone goals in day-detail

- Milestone goals are checkpoints, not day-specific.
- Tile shows done/not-done state. The "done date" of a milestone (the date its check-in was logged) is treated as the day it occurred.
- For day-detail: if the selected day is BEFORE the milestone's done date, the tile shows "not done." If on or after, shows done.
- Read-only on Week tab (milestone editing happens on Today or wrap-up).

### 7.6 Days outside the challenge range

For a 30-day challenge starting mid-week, the first week's strip will include 1-6 dots BEFORE `challenge.start_date`. Similarly the last week may include dots AFTER `challenge.end_date`.

- Dots for days outside the challenge range render as the `rest` state (small dash) AND are visually muted (e.g., 50% opacity) to signal "this day doesn't apply to the challenge."
- These cells are non-tappable — no selection, no day-detail trigger.
- The week header still shows the calendar week range; out-of-range days just appear as muted dashes within that range.

## 8. What's being removed

- The teal brand-coloured banner at the top of the Week tab with prev/next *day* arrows. Replaced by the week header.
- The `↩ Today` jump pill that appears when viewing a non-today day. Becomes redundant — today is always visible in the strip.
- The current "click goal tile → open calendar sheet" behavior for the Week tab. Replaced by tap-to-toggle directly (where editable) or silent press-only (where read-only).

The `GoalCalendarSheet` component itself is NOT removed — it's still invoked from the Summary tab and the catch-up flow.

## 9. What's being preserved

- The three-section structure (Daily Goals, Ongoing, Milestones) in the day-detail.
- `ScoreTileGrid` component (used unchanged, just with week-to-date data).
- Existing `scoreChallenge` and goal-filtering logic in `lib/scoring.ts`.
- The 24-hour grace window rule from the recent catch-up redesign.
- The realtime data refresh indicator (if currently present on this tab).
- The white-on-gray section card visual rhythm from the recent grayscale update.

## 10. Implementation notes

Files expected to change:

- `components/week/WeekView.tsx` — major restructure. New top-level layout, new components for `WeekHeader`, `WeekStrip`, `DayDetailSection`. The internal `GoalCard` and `WeekSummaryCard` may be replaced or repurposed.
- `app/week/page.tsx` — props passed to `WeekView` may need to expand to support past-week navigation (likely fetches stay the same since the page already loads all check-ins for the full challenge).
- `app/week/loading.tsx` — skeleton may need updating to match new layout (week header + strip + score tiles + day-detail).
- Possibly new utility in `lib/scoring.ts` for per-day completion calculation if not already extractable.

Files NOT expected to change:

- `components/dashboard/*` — Today tab is independent.
- `lib/supabase/*` — no schema changes; uses existing tables.
- Server actions — uses existing `toggleCheckIn` action with optional date parameter.

## 11. Out of scope (deferred)

- **Custom durations for challenges.** Already parked. Week tab assumes 30-day challenges.
- **Streaks across weeks.** Parked. Per-week strip is enough for now.
- **Buddy presence indicator on the strip** (e.g., "last active 2h ago"). Nice-to-have, not in this scope.
- **Long-press for context menu.** Not in scope.
- **Customising what week starts on** (Mon vs Sun). Locked to Monday-start per existing `getWeekStart` utility.

---

*End of design spec. Implementation plan to be drafted via `superpowers:writing-plans` after user approval.*
