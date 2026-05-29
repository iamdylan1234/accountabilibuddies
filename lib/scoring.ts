import type { Goal, CheckIn } from '@/types/database'
import { formatDate } from '@/lib/dateUtils'

export function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - diff)
  return d
}

function elapsedDays(startDate: string, today: string): number {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ty, tm - 1, td)
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1)
}

// True if the goal should appear in Today's Goals section.
// Daily/milestone → always. Frequency → today is a committed date, or
// catch_up=true and completions < past committed dates.
export function isGoalActiveToday(goal: Goal, today: string, checkIns: CheckIn[]): boolean {
  if (!goal.schedule_dates || goal.schedule_dates.length === 0) return true
  if (goal.schedule_dates.includes(today)) return true
  if (!goal.catch_up) return false
  const done = checkIns.filter(c => c.goal_id === goal.id && c.completed).length
  const past = goal.schedule_dates.filter(d => d < today).length
  return done < past
}

// True when the goal is active today ONLY because of missed past dates (catch-up state).
// Callers use this to route the goal to the red Catch-up section.
export function isGoalCatchUp(goal: Goal, today: string, checkIns: CheckIn[]): boolean {
  if (!goal.catch_up || !goal.schedule_dates || goal.schedule_dates.length === 0) return false
  if (goal.schedule_dates.includes(today)) return false
  const done = checkIns.filter(c => c.goal_id === goal.id && c.completed).length
  const past = goal.schedule_dates.filter(d => d < today).length
  return done < past
}

// Consecutive completed dates walking backwards from today.
// Daily goals walk calendar days; frequency goals walk their schedule_dates.
export function getCurrentStreak(goal: Goal, checkIns: CheckIn[], today: string): number {
  const done = new Set(checkIns.filter(c => c.goal_id === goal.id && c.completed).map(c => c.date))

  if (!goal.schedule_dates || goal.schedule_dates.length === 0) {
    const [y, m, d] = today.split('-').map(Number)
    const cursor = new Date(y, m - 1, d)
    let streak = 0
    for (let i = 0; i < 730; i++) {
      if (done.has(formatDate(cursor))) { streak++ } else { break }
      cursor.setDate(cursor.getDate() - 1)
    }
    return streak
  }

  const past = goal.schedule_dates.filter(d => d <= today).sort().reverse()
  let streak = 0
  for (const date of past) {
    if (done.has(date)) { streak++ } else { break }
  }
  return streak
}

/**
 * The single completion check-in for a milestone goal, or null if not done.
 *
 * A milestone is a one-time achievement: it is "done" the moment ANY completed
 * check-in exists, regardless of which date that check-in is stamped with. This
 * mirrors scoreGoal's milestone branch (`relevant.length > 0`), which is also
 * date-agnostic.
 *
 * Per-day views (Today, Week day-detail) MUST resolve a milestone's checked
 * state through this helper rather than a `date === today/selectedDate` lookup,
 * otherwise the milestone only renders checked on its exact completion date —
 * the cause of the "done on summary, unchecked on Today/Week" bug. Callers also
 * use the returned check-in's `date` to toggle the correct row (a done
 * milestone completed last week must be un-completed on its own date, not today).
 */
export function getMilestoneCheckIn(goalId: string, checkIns: CheckIn[]): CheckIn | null {
  return checkIns.find(c => c.goal_id === goalId && c.completed) ?? null
}

export function scoreGoal(
  goal: Goal, checkIns: CheckIn[], totalDays: number,
  startDate?: string, today?: string,
  useTargetCount?: boolean,  // true in Summary: frequency denominator = target_count, not past dates
): number {
  if (goal.type === 'cumulative') {
    if (!goal.target_count) return 0
    const total = checkIns
      .filter(c => c.goal_id === goal.id && c.value != null)
      .reduce((sum, c) => sum + (c.value ?? 0), 0)
    return Math.min(1, total / goal.target_count)
  }

  const relevant = checkIns.filter(c => c.goal_id === goal.id && c.completed)

  if (goal.type === 'milestone') return relevant.length > 0 ? 1 : 0

  if (goal.type === 'frequency') {
    // WeekView (useTargetCount=false): score against past scheduled dates in the week window.
    // Summary (useTargetCount=true): score against total target_count so 1/12 = 8%, not 1/1 = 100%.
    if (!useTargetCount && startDate && today && goal.schedule_dates && goal.schedule_dates.length > 0) {
      const past = goal.schedule_dates.filter(d => d >= startDate && d <= today).length
      return past === 0 ? 0 : Math.min(1, relevant.length / past)
    }
    return Math.min(1, relevant.length / (goal.target_count ?? 1))
  }

  // daily: Summary uses full challenge length; WeekView uses elapsed days in window
  const denom = useTargetCount ? totalDays : (startDate && today ? elapsedDays(startDate, today) : totalDays)
  return denom === 0 ? 0 : Math.min(1, relevant.length / denom)
}

// Excludes cumulative goals from challenge % (they are progress reminders, not scored).
export function scoreChallenge(
  goals: Goal[], checkIns: CheckIn[], totalDays: number,
  startDate?: string, today?: string,
  useTargetCount?: boolean,
): number {
  const scorable = goals.filter(g => g.type !== 'cumulative')
  if (scorable.length === 0) return 0
  const total = scorable.reduce((sum, g) => sum + scoreGoal(g, checkIns, totalDays, startDate, today, useTargetCount), 0)
  return Math.round((total / scorable.length) * 100)
}

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

// Number of past scheduled days (within 7-day lookback from today) that have no completed check-in.
// Returns 0 for cumulative and milestone goals — they are never "missed" in this sense.
export function getMissedDays(
  goal: Goal,
  checkIns: CheckIn[],
  today: string,
  challengeStart: string,
  lookbackDays: number = 7,
  endOffset: number = 1,
): number {
  if (goal.type === 'cumulative' || goal.type === 'milestone') return 0

  const [ty, tm, td] = today.split('-').map(Number)
  // endOffset = 1 (default) → end at yesterday; endOffset = 2 → end at day-before-yesterday
  const yesterday = formatDate(new Date(ty, tm - 1, td - endOffset))

  // Lookback window: the later of (challengeStart) and (today − lookbackDays).
  // Default 7 days for Today-tab urgency view; pass a large number (e.g. 9999)
  // from Summary contexts to get the full lifetime missed-day count.
  const lookbackDate = new Date(ty, tm - 1, td - lookbackDays)
  const lookbackFormatted = formatDate(lookbackDate)
  const lookbackStart = lookbackFormatted > challengeStart ? lookbackFormatted : challengeStart

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
  const end = new Date(ty, tm - 1, td - endOffset)
  while (cursor <= end) {
    if (!doneSet.has(formatDate(cursor))) missed++
    cursor.setDate(cursor.getDate() + 1)
  }
  return missed
}

// For a FREQUENCY goal, returns the catch-up state for the Today tile:
//   - caughtUpToday: 1 if today's check-in is a real make-up (non-scheduled
//                    completion that consumes a pending missed scheduled day),
//                    0 otherwise.
//   - netPending: how many misses remain pending AFTER today (i.e. after
//                 today's possible make-up is applied).
//
// Mirrors the calendar's makeup/extra classification so Today and Summary
// agree on what counts. Today is treated specially — if today is scheduled
// and not yet completed, it does NOT count as a miss (the day's not over).
export function getCatchUpState(
  goal: Goal,
  checkIns: CheckIn[],
  today: string,
  startDate: string,
): { caughtUpToday: number; netPending: number } {
  if (goal.type !== 'frequency') return { caughtUpToday: 0, netPending: 0 }
  if (!goal.schedule_dates || goal.schedule_dates.length === 0) {
    return { caughtUpToday: 0, netPending: 0 }
  }

  const scheduleSet = new Set(goal.schedule_dates)
  const completedSet = new Set(
    checkIns.filter(c => c.goal_id === goal.id && c.completed).map(c => c.date)
  )

  const [sy, sm, sd] = startDate.split('-').map(Number)
  const cursor = new Date(sy, sm - 1, sd)
  let pendingMisses = 0
  let caughtUpToday = 0

  while (true) {
    const ds = formatDate(cursor)
    if (ds > today) break

    const scheduled = scheduleSet.has(ds)
    const completed = completedSet.has(ds)

    if (ds === today) {
      // Today is special: don't count as missed even if scheduled+not-completed
      // (the day's still ongoing). Only consume a pending miss if today is a
      // non-scheduled completion (a real make-up).
      if (!scheduled && completed && pendingMisses > 0) {
        pendingMisses--
        caughtUpToday = 1
      }
    } else {
      // Past day
      if (scheduled && !completed) pendingMisses++
      else if (!scheduled && completed && pendingMisses > 0) pendingMisses--
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return { caughtUpToday, netPending: pendingMisses }
}

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
 *
 * NOTE — future-rest precedence (§4.2 of the week-tab redesign spec): the
 * "zero scheduled goals → rest" check runs BEFORE the "day > today → future"
 * check. A future day with no scheduled goals therefore returns "rest", not
 * "future". This is intentional and spec-mandated behaviour.
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

  const scheduledIds = new Set(scheduled.map(g => g.id))
  const completedIds = new Set(
    checkIns
      .filter(c => c.date === day && c.completed && scheduledIds.has(c.goal_id))
      .map(c => c.goal_id)
  )
  const completedCount = completedIds.size

  if (completedCount === 0) return 'empty'
  if (completedCount === scheduled.length) return 'full'
  return 'partial'
}

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

  // The denominator is the count scheduled THIS week, not `goal.target_count`. Showing
  // "2/3 wk" tells the user how many of this week's scheduled days they've hit. Using
  // `goal.target_count` would conflate weekly progress with overall target — see
  // `scoreGoal` for the same distinction.
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
  const cleanTotal = parseFloat(total.toFixed(2))
  return goal.target_unit
    ? `+${cleanTotal} ${goal.target_unit} wk`
    : `+${cleanTotal} wk`
}
