import type { Goal, CheckIn } from '@/types/database'

export interface WeeklyGoalPlan {
  goal: Goal
  neededThisWeek: number
  suggestedDays: string[] // ISO date strings for Mon–Sun of current week
}

export function computeWeeklyPlan(
  goal: Goal,
  checkIns: CheckIn[],
  totalDays: number,
  remainingWeeks: number,
  sundayDate: string,
  monthEndDate?: string
): WeeklyGoalPlan {
  const relevant = checkIns.filter(c => c.goal_id === goal.id && c.completed)

  // Mon of this week
  const sunday = new Date(sundayDate)
  const monday = new Date(sunday)
  monday.setDate(sunday.getDate() - 6)

  let neededThisWeek = 0

  if (goal.type === 'milestone') {
    neededThisWeek = relevant.length > 0 ? 0 : 1
  } else if (goal.type === 'daily') {
    if (monthEndDate) {
      const end = new Date(monthEndDate)
      // Days remaining from today (sunday) through end of month, capped at 7
      const daysRemaining = Math.floor((end.getTime() - sunday.getTime()) / 86400000) + 1
      neededThisWeek = Math.min(7, Math.max(0, daysRemaining))
    } else {
      neededThisWeek = 7
    }
  } else {
    // frequency
    const target = goal.target_count ?? 1
    const remaining = Math.max(0, target - relevant.length)
    const weeks = Math.max(1, remainingWeeks)
    neededThisWeek = Math.min(7, Math.ceil(remaining / weeks))
  }

  const suggestedDays = allocateDays(neededThisWeek, monday.toISOString().split('T')[0])

  return { goal, neededThisWeek, suggestedDays }
}

export function allocateDays(needed: number, weekStartMonday: string): string[] {
  if (needed === 0) return []
  const days: string[] = []
  const start = new Date(weekStartMonday)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d.toISOString().split('T')[0])
  }
  if (needed >= 7) return days
  // Evenly space needed completions across 7 days
  const step = 7 / needed
  const selected: string[] = []
  for (let i = 0; i < needed; i++) {
    selected.push(days[Math.round(i * step)])
  }
  return selected
}
