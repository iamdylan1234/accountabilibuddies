import type { Goal, CheckIn } from '@/types/database'

export function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - diff)
  return d
}

function fmt(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
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
      if (done.has(fmt(cursor))) { streak++ } else { break }
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
    if (goal.schedule_dates && goal.schedule_dates.length > 0) {
      // When startDate is provided (e.g. weekStartStr) only count scheduled dates within that window.
      // This lets WeekView scope the denominator to the current week, while ScoreSummary
      // (which passes challengeStartDate) still counts all past dates correctly.
      const past = today
        ? goal.schedule_dates.filter(d => (!startDate || d >= startDate) && d <= today).length
        : goal.schedule_dates.length
      return past === 0 ? 0 : Math.min(1, relevant.length / past)
    }
    return Math.min(1, relevant.length / (goal.target_count ?? 1))
  }

  // daily
  const denom = startDate && today ? elapsedDays(startDate, today) : totalDays
  return denom === 0 ? 0 : Math.min(1, relevant.length / denom)
}

// Excludes cumulative goals from challenge % (they are progress reminders, not scored).
export function scoreChallenge(
  goals: Goal[], checkIns: CheckIn[], totalDays: number,
  startDate?: string, today?: string,
): number {
  const scorable = goals.filter(g => g.type !== 'cumulative')
  if (scorable.length === 0) return 0
  const total = scorable.reduce((sum, g) => sum + scoreGoal(g, checkIns, totalDays, startDate, today), 0)
  return Math.round((total / scorable.length) * 100)
}
