import type { Goal, CheckIn } from '@/types/database'

export function scoreGoal(goal: Goal, checkIns: CheckIn[], totalDays: number): number {
  const relevant = checkIns.filter(c => c.goal_id === goal.id && c.completed)

  if (goal.type === 'daily') {
    return totalDays === 0 ? 0 : relevant.length / totalDays
  }

  if (goal.type === 'milestone') {
    return relevant.length > 0 ? 1 : 0
  }

  // frequency
  const target = goal.target_count ?? 1
  return Math.min(1, relevant.length / target)
}

export function scoreChallenge(goals: Goal[], checkIns: CheckIn[], totalDays: number): number {
  if (goals.length === 0) return 0
  const total = goals.reduce((sum, g) => sum + scoreGoal(g, checkIns, totalDays), 0)
  return Math.round((total / goals.length) * 100)
}
