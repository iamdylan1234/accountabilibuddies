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
): number {
  if (goal.type === 'cumulative' || goal.type === 'milestone') return 0

  const [ty, tm, td] = today.split('-').map(Number)
  const yesterday = formatDate(new Date(ty, tm - 1, td - 1))

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
  const end = new Date(ty, tm - 1, td - 1)
  while (cursor <= end) {
    if (!doneSet.has(formatDate(cursor))) missed++
    cursor.setDate(cursor.getDate() + 1)
  }
  return missed
}
