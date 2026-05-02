import type { Goal, CheckIn } from '@/types/database'

export function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - diff)
  return d
}

// Count days in [startDate, today] whose day-of-week is in scheduleDays.
// null scheduleDays = every day → falls back to total elapsed days.
export function getScheduledDaysElapsed(
  scheduleDays: number[] | null,
  startDate: string,
  today: string,
): number {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ty, tm - 1, td)
  if (!scheduleDays || scheduleDays.length === 0) {
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1)
  }
  let count = 0
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (scheduleDays.includes(d.getDay())) count++
  }
  return count
}

// Returns true if the goal should appear today:
// - no schedule → always true
// - today is a scheduled day → true
// - catch_up=true and completed count < scheduled days elapsed → true
export function isGoalActiveToday(
  goal: Goal,
  today: string,
  checkIns: CheckIn[],
  startDate: string,
): boolean {
  if (!goal.schedule_days || goal.schedule_days.length === 0) return true
  const [y, m, d] = today.split('-').map(Number)
  const todayDow = new Date(y, m - 1, d).getDay()
  if (goal.schedule_days.includes(todayDow)) return true
  if (!goal.catch_up) return false
  const completed = checkIns.filter(c => c.goal_id === goal.id && c.completed).length
  // Look back up to 6 days to capture at least one full scheduled cycle.
  const todayDate = new Date(y, m - 1, d)
  const lookbackDate = new Date(todayDate)
  lookbackDate.setDate(lookbackDate.getDate() - 6)
  const lookbackStr = [
    lookbackDate.getFullYear(),
    String(lookbackDate.getMonth() + 1).padStart(2, '0'),
    String(lookbackDate.getDate()).padStart(2, '0'),
  ].join('-')
  const scheduled = getScheduledDaysElapsed(goal.schedule_days, lookbackStr, today)
  return completed < scheduled
}

// Consecutive completed scheduled days ending on (or before) today.
// For unscheduled goals, counts calendar days.
export function getCurrentStreak(goal: Goal, checkIns: CheckIn[], today: string): number {
  const completed = new Set(
    checkIns.filter(c => c.goal_id === goal.id && c.completed).map(c => c.date),
  )
  const scheduleDays = goal.schedule_days
  const [y, m, d] = today.split('-').map(Number)
  const cursor = new Date(y, m - 1, d)
  let streak = 0
  for (let i = 0; i < 730; i++) {
    const dow = cursor.getDay()
    const dateStr = [
      cursor.getFullYear(),
      String(cursor.getMonth() + 1).padStart(2, '0'),
      String(cursor.getDate()).padStart(2, '0'),
    ].join('-')
    const isScheduled = !scheduleDays || scheduleDays.length === 0 || scheduleDays.includes(dow)
    if (isScheduled) {
      if (completed.has(dateStr)) {
        streak++
      } else {
        break
      }
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// scoreGoal now accepts optional startDate + today to compute the correct
// denominator for scheduled daily goals. Falls back to totalDays when absent.
export function scoreGoal(
  goal: Goal,
  checkIns: CheckIn[],
  totalDays: number,
  startDate?: string,
  today?: string,
): number {
  const relevant = checkIns.filter(c => c.goal_id === goal.id && c.completed)

  if (goal.type === 'milestone') {
    return relevant.length > 0 ? 1 : 0
  }

  if (goal.type === 'frequency') {
    const target = goal.target_count ?? 1
    return Math.min(1, relevant.length / target)
  }

  // daily — use scheduled days elapsed when we have the date context
  const denominator =
    startDate && today && goal.schedule_days && goal.schedule_days.length > 0
      ? getScheduledDaysElapsed(goal.schedule_days, startDate, today)
      : totalDays
  return denominator === 0 ? 0 : relevant.length / denominator
}

// startDate + today are optional; when provided, scheduled daily goals use the
// correct per-goal denominator instead of the coarser totalDays fallback.
export function scoreChallenge(
  goals: Goal[],
  checkIns: CheckIn[],
  totalDays: number,
  startDate?: string,
  today?: string,
): number {
  if (goals.length === 0) return 0
  const total = goals.reduce(
    (sum, g) => sum + scoreGoal(g, checkIns, totalDays, startDate, today),
    0,
  )
  return Math.round((total / goals.length) * 100)
}
