import { computeWeeklyPlan, allocateDays } from '../weekly-plan'
import type { Goal, CheckIn } from '@/types/database'

const baseGoal = (type: Goal['type'], target_count: number | null = null, id = 'g1'): Goal => ({
  id, challenge_id: 'c1', user_id: 'u1', title: 'Test', type, target_count, created_at: '',
  schedule_days: null, catch_up: false,
})

describe('computeWeeklyPlan', () => {
  it('daily goal needs 7 completions this week', () => {
    const goal = baseGoal('daily')
    const result = computeWeeklyPlan(goal, [], 3, '2026-05-03') // Sunday week 3
    expect(result.neededThisWeek).toBe(7)
  })

  it('daily goal caps at remaining days in month', () => {
    const goal = baseGoal('daily')
    // Sunday 2026-05-24, monthEnd 2026-05-26 → nextMonday=May 25, end=May 26 → 2 days
    const result = computeWeeklyPlan(goal, [], 4, '2026-05-24', '2026-05-26')
    expect(result.neededThisWeek).toBe(2)
  })

  it('frequency goal distributes remaining completions across remaining weeks', () => {
    const goal = baseGoal('frequency', 12)
    const checkIns: CheckIn[] = Array.from({ length: 4 }, (_, i) => ({
      id: String(i), goal_id: 'g1', user_id: 'u1',
      date: `2026-05-0${i + 1}`, completed: true, created_at: '',
    }))
    // 8 left, 2 remaining weeks → 4 this week
    const result = computeWeeklyPlan(goal, checkIns, 2, '2026-05-10')
    expect(result.neededThisWeek).toBe(4)
  })

  it('frequency goal caps needed at 7', () => {
    const goal = baseGoal('frequency', 20)
    // 20 needed, 1 week left → would be 20, capped at 7
    const result = computeWeeklyPlan(goal, [], 1, '2026-05-24')
    expect(result.neededThisWeek).toBe(7)
  })

  it('milestone goal not done returns needed=1', () => {
    const goal = baseGoal('milestone')
    const result = computeWeeklyPlan(goal, [], 2, '2026-05-10')
    expect(result.neededThisWeek).toBe(1)
  })

  it('milestone goal already done returns needed=0', () => {
    const goal = baseGoal('milestone')
    const checkIns: CheckIn[] = [{
      id: '1', goal_id: 'g1', user_id: 'u1', date: '2026-05-01', completed: true, created_at: '',
    }]
    const result = computeWeeklyPlan(goal, checkIns, 2, '2026-05-10')
    expect(result.neededThisWeek).toBe(0)
  })
})

describe('allocateDays', () => {
  it('spreads 3 completions across Mon-Sun starting from Monday', () => {
    const days = allocateDays(3, '2026-05-11') // Monday
    expect(days).toHaveLength(3)
    // Should be roughly evenly spaced across the week
    expect(new Set(days).size).toBe(3)
  })

  it('allocates every day when needed equals 7', () => {
    const days = allocateDays(7, '2026-05-11')
    expect(days).toHaveLength(7)
  })

  it('returns empty array when needed is 0', () => {
    expect(allocateDays(0, '2026-05-11')).toHaveLength(0)
  })
})
