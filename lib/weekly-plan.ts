import type { Goal, CheckIn } from '@/types/database'

export interface WeeklyGoalPlan {
  goal: Goal
  neededThisWeek: number
  suggestedDays: string[] // ISO date strings for Mon–Sun of current week
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d) // local midnight — no UTC shift
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function computeWeeklyPlan(
  goal: Goal,
  checkIns: CheckIn[],
  remainingWeeks: number,
  sundayDate: string,
  monthEndDate?: string
): WeeklyGoalPlan {
  const relevant = checkIns.filter(c => c.goal_id === goal.id && c.completed)

  // Mon of this week
  const sunday = parseDate(sundayDate)
  const monday = new Date(sunday)
  monday.setDate(sunday.getDate() - 6)

  let neededThisWeek = 0

  if (goal.type === 'milestone') {
    neededThisWeek = relevant.length > 0 ? 0 : 1
  } else if (goal.type === 'daily') {
    if (monthEndDate) {
      const nextMonday = new Date(sunday)
      nextMonday.setDate(sunday.getDate() + 1)
      const end = parseDate(monthEndDate)
      const daysInWeek = Math.floor((end.getTime() - nextMonday.getTime()) / 86400000) + 1
      neededThisWeek = Math.min(7, Math.max(0, daysInWeek))
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

  const suggestedDays = allocateDays(neededThisWeek, formatDate(monday))

  return { goal, neededThisWeek, suggestedDays }
}

export function allocateDays(needed: number, weekStartMonday: string): string[] {
  if (needed === 0) return []
  const days: string[] = []
  const start = parseDate(weekStartMonday)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(formatDate(d))
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
