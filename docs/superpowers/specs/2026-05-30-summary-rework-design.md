# Summary Tab Visual Distinction — Design Spec

**Date:** 2026-05-30
**Status:** Approved for implementation
**Bar:** Make Summary feel like a distinct *scorecard* surface, not a near-reskin of Today.

---

## Problem

`/wrap-up` (`ScoreSummary`) shares too much structural and visual DNA with `/dashboard` (`DashboardClient`). Both surfaces follow the same rhythm:

| Element | Today | Summary |
|---|---|---|
| Header strip | Teal gradient · "Day X of Y" | Teal gradient · "Day X of Y · Summary" |
| Score row | `ScoreTileGrid` (you vs buddy) | `ScoreTileGrid` (you vs buddy) |
| Body | Three goal sections w/ pill labels | Three goal sections w/ small labels |
| Goal cards | Check-in tiles (binary) | % progress cards |
| Drill-in | (none — direct interact) | Calendar sheet |

A user glancing between tabs sees the same structural template — "Today minus interactivity, plus percentages." Summary's job is *fundamentally different* — it's the reflective, analytical surface, the "how am I doing across this whole month?" view. The current layout doesn't communicate that.

## Solution overview

Four layered changes that compound. Each adds visual identity to Summary while preserving the goal-card drill-down (calendar sheet, etc.):

1. **30-day calendar heat-map** at the top — new visual element with no equivalent on Today.
2. **Hero score tiles + trend** — replace the small score row with bigger primary visual weight, plus a week-over-week trend indicator.
3. **Status-based section organization** — replace "Daily / Ongoing / Milestones" with "Needs attention / Catching up / On track" — the analytical lens.
4. **Distinct page chrome** — subtle warm background + thin accent bar to signal "review mode" at a glance.

After these changes: a glance tells the user "this is the scorecard surface." The card-level drill-down is preserved unchanged; only the framing transforms.

---

## Change 1 — 30-day calendar heat-map

A grid at the top of `/wrap-up`, just below the existing header strip. **One row per buddy** (you on top, buddy below — same vertical order as the hero scores below it). Each day cell is shaded by the % of that day's scheduled goals the user completed.

### Layout

Calendar-aligned. Day-of-week columns (M T W T F S S) header at the top, then a 5–6 week grid for each buddy. Days *outside* the challenge are blank space (skipped); days *inside* the challenge are rendered as cells.

```
     M  T  W  T  F  S  S
You  ·  ·  ·  ▢  ▣  ▣  ▣
     ▣  ▣  ▢  ▣  ▣  ▣  ▢
     ▣  ▢  ▣  ▣  ▣  ▣  ▢
     ▣  ▣  ▣  ▣  ◯  ·  ·
Bud  ·  ·  ·  ▢  ▣  ▣  ▢
     ▢  ▣  ▣  ▢  ▣  ▣  ▢
     ▢  ▢  ▣  ▣  ▣  ▢  ▢
     ▣  ▣  ▢  ▢  ◯  ·  ·
```

(`▣` = high, `▢` = mid, `◯` = today ring, `·` = outside challenge.)

### Cell intensity — 5-level discrete scale

| Level | Completion % | Class |
|---|---|---|
| -1 | Rest day (0 scheduled goals) | `border border-gray-300 bg-transparent` |
| 0 | 0% completed | `bg-gray-200` |
| 1 | 1–25% | `bg-teal-200` |
| 2 | 26–50% | `bg-teal-400` |
| 3 | 51–75% | `bg-teal-600` |
| 4 | 76–100% | `bg-teal-800` |

Discrete levels (not a continuous gradient) read more clearly at small size. Today's cell additionally gets a thin teal ring around it for orientation (`ring-2 ring-teal-500`) — the ring is on top of whatever intensity fill is there, so the data stays visible.

### What counts toward "day completion %"

Only `daily` goals + `frequency` goals whose `schedule_dates` includes that date. Cumulative and milestone goals are excluded — they don't have a day-level "due" notion. A day with 0 scheduled goals is rendered as a rest day (level -1), distinct from "0% completed" (level 0).

### Tap behavior

For v1, **non-interactive** — just a visual. Drill-in (tap a cell → calendar sheet for that day) is Phase 2.

### Files

- New: `lib/heatmap.ts` (pure helpers: `dailyCompletionPct`, `intensityLevel`, `weeklyTrend`)
- New: `lib/__tests__/heatmap.test.ts` (TDD)
- New: `components/wrap-up/ChallengeHeatMap.tsx`
- Modify: `components/wrap-up/ScoreSummary.tsx` (mount the heat-map after the header strip)

---

## Change 2 — Hero score + trend

Replace the existing small `ScoreTileGrid` row with bigger hero cards. Summary's score *is* the centerpiece of this tab.

### Layout

Two **stacked** cards (vertical), not side-by-side. Each card:

- Big % number (`text-5xl font-black text-gray-900`)
- Buddy name + "X / 30 days active" sub-line
- Optional trend chip below: `↑ +12% vs last week` (green) or `↓ -8% vs last week` (red). Hidden if fewer than 14 days have elapsed since challenge start — comparing to <7 days of prior data is noisy.
- Subtle gradient border / crown emoji on the leading card if there's a winner

### Trend computation

`weeklyTrend(goals, checkIns, startDate, today)`:
- Score the last 7 days using existing `scoreChallenge(goals, checkInsInWindow, 7, addDays(today,-6), today, true)`
- Score the prior 7 days using `scoreChallenge(goals, checkInsInWindow, 7, addDays(today,-13), addDays(today,-7), true)`
- Returns `Math.round(last7 - prior7)` as percentage points
- Returns `null` if `daysBetween(startDate, today) < 14`

### Files

- Modify: `lib/heatmap.ts` (add `weeklyTrend` helper)
- Modify: `lib/__tests__/heatmap.test.ts` (add tests for `weeklyTrend`)
- New: `components/wrap-up/HeroScore.tsx`
- Modify: `components/wrap-up/ScoreSummary.tsx` (replace existing `ScoreTileGrid` usage)

---

## Change 3 — Status-based section organization

Drop the existing "Daily Goals / Ongoing / Milestones" type-based grouping. Replace with three status buckets, each a `SummaryGoalCard` list rendered through the existing `GoalPairGrid`:

- 🔴 **Needs attention** — score < 50%
- 🟡 **Catching up** — score 50–79%
- 🟢 **On track** — score ≥ 80% or complete

Each section uses the existing pill-label pattern from `DashboardClient` (matching what we just did to Profile). Empty sections are not rendered.

### Why drop type-based grouping?

Users don't think *"what are my daily goals doing?"* — they think *"what's slipping?"*. Status buckets put the analytical lens primary, aligned with the tab's reflective purpose. The type info is already visible inside each `SummaryGoalCard` (via the subscript: "3 of 5 days done", "12 / 100 km", "Done", etc.).

### Bucketing logic

For `daily / frequency / cumulative` goals: bucket directly by `scoreGoal(goal, checkIns, totalDays, startDate, today, true) * 100`.

For `milestone` goals: there's no continuous progress to bucket on. Use day-elapsed % as expected progress:
- If complete → **On track**
- If incomplete AND day-elapsed % > 80% → **Needs attention**
- If incomplete AND 50% ≤ day-elapsed % ≤ 80% → **Catching up**
- If incomplete AND day-elapsed % < 50% → **On track** (still plenty of time)

Within each section, sort by score ascending (most-at-risk first within "Needs attention", closest-to-done first within "On track").

### Files

- Modify: `components/wrap-up/ScoreSummary.tsx` (replace the existing three sections with status-based ones; add a `bucketGoal` helper inline or extracted)

---

## Change 4 — Distinct page chrome

Three small chrome tweaks that, combined, make a glance at the tab unmistakably distinct from Today:

- **Background:** `bg-stone-50` (subtle warm cream) on the page wrapper. Today is white. The warm tint signals "review/reflection" without being jarring.
- **Header accent:** a thin amber bar (1.5px, `bg-amber-400/70`) immediately below the existing teal gradient strip. Subtle but visible — it grounds the surface as analytical.
- **Section pill labels:** swap from `bg-white` to `bg-stone-100` so they harmonize with the warm background rather than fighting it.

### Files

- Modify: `components/wrap-up/ScoreSummary.tsx` (background class + accent bar + pill bg swap)

---

## Decisions baked in (override during review if you want)

1. **Heat-map cells: 5-level discrete teal scale** (not a continuous gradient). Discrete levels are more legible at small cell size.
2. **Today's cell gets a ring, not a fill swap.** Keeps the heat data visible AND shows orientation.
3. **Rest days (no scheduled goals) render as faint outlines** — distinct from "0% completed."
4. **Hero scores stacked vertically.** On mobile this gives each card breathing room and lets the type be bigger.
5. **Trend indicator hides if <14 days of data.** Comparing to fewer than 7 days of prior is statistically noisy.
6. **Status buckets drop type grouping entirely** — no toggle, no hybrid. Cleaner mental model; type info is already in the card subscripts.
7. **Warm background (`stone-50`, not `slate-50`).** Reflective tone — cool would feel more "data dashboard" which isn't the buddy app's voice.
8. **Heat-map is non-interactive in v1.** Tap-to-drill-in (calendar sheet for that day) is Phase 2.

---

## Schema notes

**No schema changes.** All four changes use existing data: `goals`, `check_ins`, `start_date`, `end_date`.

---

## Edge cases

- **Brand-new challenge (Day 1):** heat-map shows mostly future cells (skipped as outside-window). The first cell lights up after the user logs a check-in. Hero trend is hidden (insufficient data).
- **All days are rest days for one user:** heat-map row is all faint outlines. Hero score could be 0%/null — render "—" gracefully.
- **Completed challenge viewed historically (`/wrap-up?challenge=<id>`):** heat-map renders the final state, no "today" ring. Hero scores show finals.
- **One buddy hasn't checked in at all:** their heat-map row is all level-0 fills (gray). Hero shows 0%. No crash.
- **Milestone with 0% goal-score but challenge at Day 2:** falls into "On track" via the day-elapsed adjustment. Important — don't scare the user with "Needs attention" on Day 2 because a 30-day milestone isn't done yet.
- **Trend computation around midnight:** uses the same `today` source the rest of `ScoreSummary` uses (`formatDate(new Date())` for active, `serverToday` for historical). Stable.

---

## Out of scope (Phase 2)

- Tap-to-drill on heat-map cells (open the calendar sheet for that day)
- Per-goal sparklines (mini-charts showing 30-day completion per goal)
- Animated transitions when data updates
- Sharing the heat-map as an image (social-sharing feature)
- Toggle between status-grouping and type-grouping
- A "challenge story" timeline showing key moments (first miss, longest streak, etc.)

---

## Testing

- **Unit tests** for `lib/heatmap.ts`:
  - `dailyCompletionPct` — 6 cases: rest day (null), 0%, 100%, 50%, frequency-not-scheduled, ignores incomplete check-ins
  - `intensityLevel` — 7 cases: null/-1, 0/0, 0.01/1, 0.25/1, 0.50/2, 0.75/3, 1.0/4
  - `weeklyTrend` — 3 cases: insufficient data (null), positive delta, negative delta

- **Manual smoke:**
  1. `/wrap-up` on an active challenge → heat-map visible, today ringed, hero scores prominent, trend chip shown if 14+ days in, sections grouped by status, warm bg + accent bar visible
  2. Tap a goal card → existing calendar sheet still works
  3. Historical view (`/wrap-up?challenge=<old-id>`) → final-state heat-map (no today ring), no trend chip
  4. Brand-new challenge (Day 1) → heat-map mostly empty, no trend chip, sections all "On track"
  5. Edge cases above render without errors

- **tsc + production build** as the verification gate
- **Lint scoped to changed files** before merge

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `lib/heatmap.ts` | create | Pure helpers: `dailyCompletionPct`, `intensityLevel`, `weeklyTrend` |
| `lib/__tests__/heatmap.test.ts` | create | Unit tests for the three helpers |
| `components/wrap-up/ChallengeHeatMap.tsx` | create | 30-day calendar grid component (Change 1) |
| `components/wrap-up/HeroScore.tsx` | create | Big stacked score cards with trend (Change 2) |
| `components/wrap-up/ScoreSummary.tsx` | modify | Mount new components; status-bucket sections (Change 3); page chrome (Change 4) |

Total: 4 new files, 1 modified. ~3–4 days of focused work for commercial-grade execution.
