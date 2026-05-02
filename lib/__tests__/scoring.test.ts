import {
  scoreGoal, scoreChallenge, getWeekStart,
  getScheduledDaysElapsed, isGoalActiveToday, getCurrentStreak,
} from '../scoring'
import type { Goal, CheckIn } from '@/types/database'

const baseGoal = (type: Goal['type'], target_count: number | null = null): Goal => ({
  id: 'g1', challenge_id: 'c1', user_id: 'u1',
  title: 'Test', type, target_count, created_at: '',
  schedule_days: null, catch_up: false,
})

describe('scoreGoal', () => {
  it('scores a daily goal as completed/total days', () => {
    const goal = baseGoal('daily')
    const checkIns: CheckIn[] = [
      { id: '1', goal_id: 'g1', user_id: 'u1', date: '2026-05-01', completed: true, created_at: '' },
      { id: '2', goal_id: 'g1', user_id: 'u1', date: '2026-05-02', completed: true, created_at: '' },
    ]
    expect(scoreGoal(goal, checkIns, 10)).toBeCloseTo(0.2)
  })

  it('scores a milestone goal as 1 if completed, 0 otherwise', () => {
    const goal = baseGoal('milestone')
    const withCheckIn: CheckIn[] = [
      { id: '1', goal_id: 'g1', user_id: 'u1', date: '2026-05-01', completed: true, created_at: '' },
    ]
    expect(scoreGoal(goal, withCheckIn, 30)).toBe(1)
    expect(scoreGoal(goal, [], 30)).toBe(0)
  })

  it('scores a frequency goal as completions/target, capped at 1', () => {
    const goal = baseGoal('frequency', 10)
    const checkIns: CheckIn[] = Array.from({ length: 7 }, (_, i) => ({
      id: String(i), goal_id: 'g1', user_id: 'u1',
      date: `2026-05-0${i + 1}`, completed: true, created_at: '',
    }))
    expect(scoreGoal(goal, checkIns, 30)).toBeCloseTo(0.7)
  })

  it('caps frequency goal score at 1 when over target', () => {
    const goal = baseGoal('frequency', 5)
    const checkIns: CheckIn[] = Array.from({ length: 8 }, (_, i) => ({
      id: String(i), goal_id: 'g1', user_id: 'u1',
      date: `2026-05-0${i + 1}`, completed: true, created_at: '',
    }))
    expect(scoreGoal(goal, checkIns, 30)).toBe(1)
  })
})

describe('scoreChallenge', () => {
  it('returns average of goal scores as a percentage', () => {
    const goals: Goal[] = [
      baseGoal('milestone'),
      { ...baseGoal('milestone'), id: 'g2' },
    ]
    const checkIns: CheckIn[] = [
      { id: '1', goal_id: 'g1', user_id: 'u1', date: '2026-05-01', completed: true, created_at: '' },
    ]
    // First goal completed (1.0), second not (0.0) → average 50%
    expect(scoreChallenge(goals, checkIns, 30)).toBe(50)
  })

  it('returns 0 when no goals', () => {
    expect(scoreChallenge([], [], 30)).toBe(0)
  })
})

describe('getWeekStart', () => {
  it('returns Monday when given a Monday', () => {
    // 2026-04-27 is a Monday
    const result = getWeekStart(new Date(2026, 3, 27))
    expect(result).toEqual(new Date(2026, 3, 27))
  })

  it('returns the previous Monday when given a Wednesday', () => {
    // 2026-04-29 is a Wednesday → Monday 2026-04-27
    const result = getWeekStart(new Date(2026, 3, 29))
    expect(result).toEqual(new Date(2026, 3, 27))
  })

  it('returns the previous Monday when given a Sunday', () => {
    // 2026-05-03 is a Sunday → Monday 2026-04-27
    const result = getWeekStart(new Date(2026, 4, 3))
    expect(result).toEqual(new Date(2026, 3, 27))
  })

  it('returns midnight (no time component)', () => {
    const result = getWeekStart(new Date(2026, 3, 30, 15, 30, 0))
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })
})

describe('getScheduledDaysElapsed', () => {
  it('counts all elapsed days when scheduleDays is null', () => {
    // 2026-04-27 to 2026-04-29 = 3 days
    expect(getScheduledDaysElapsed(null, '2026-04-27', '2026-04-29')).toBe(3)
  })

  it('counts only scheduled days in range', () => {
    // 2026-04-27 (Mon) to 2026-05-03 (Sun): only one Sunday [0] = 2026-05-03
    expect(getScheduledDaysElapsed([0], '2026-04-27', '2026-05-03')).toBe(1)
  })

  it('counts multiple scheduled days across two weeks', () => {
    // Mon+Wed+Fri [1,3,5] over 2026-04-27..2026-05-10 (2 full weeks) = 6
    expect(getScheduledDaysElapsed([1, 3, 5], '2026-04-27', '2026-05-10')).toBe(6)
  })

  it('returns 1 on the start date when that day is scheduled', () => {
    // 2026-04-27 is Monday (1)
    expect(getScheduledDaysElapsed([1], '2026-04-27', '2026-04-27')).toBe(1)
  })

  it('returns 0 when no scheduled days have fallen yet', () => {
    // Sunday-only goal, range is Mon-Sat only
    expect(getScheduledDaysElapsed([0], '2026-04-27', '2026-05-02')).toBe(0)
  })
})

describe('isGoalActiveToday', () => {
  const scheduledGoal = (schedule_days: number[] | null, catch_up = false): Goal => ({
    ...baseGoal('daily'), schedule_days, catch_up,
  })

  it('always true when no schedule set', () => {
    expect(isGoalActiveToday(scheduledGoal(null), '2026-04-27', [], '2026-04-27')).toBe(true)
  })

  it('true when today is a scheduled day', () => {
    // 2026-04-27 is Monday (1)
    expect(isGoalActiveToday(scheduledGoal([1]), '2026-04-27', [], '2026-04-27')).toBe(true)
  })

  it('false when today is not scheduled and catch_up is false', () => {
    // Sunday-only goal, today is Monday
    expect(isGoalActiveToday(scheduledGoal([0]), '2026-04-27', [], '2026-04-27')).toBe(false)
  })

  it('true when catch_up is true and user is behind', () => {
    // Sunday goal, today is Monday 2026-04-28, Sunday 2026-04-27 had no check-in
    const goal = scheduledGoal([0], true)
    expect(isGoalActiveToday(goal, '2026-04-28', [], '2026-04-27')).toBe(true)
  })

  it('false when catch_up is true but user is not behind', () => {
    // Sunday goal, completed last Sunday, today is Monday
    const goal = scheduledGoal([0], true)
    const checkIns: CheckIn[] = [
      { id: '1', goal_id: 'g1', user_id: 'u1', date: '2026-04-27', completed: true, created_at: '' },
    ]
    // 1 Sunday elapsed (2026-04-27), 1 completed → not behind
    expect(isGoalActiveToday(goal, '2026-04-28', checkIns, '2026-04-27')).toBe(false)
  })
})

describe('getCurrentStreak', () => {
  it('returns 0 when no check-ins', () => {
    expect(getCurrentStreak(baseGoal('daily'), [], '2026-05-02')).toBe(0)
  })

  it('counts consecutive daily check-ins backwards from today', () => {
    const checkIns: CheckIn[] = [
      { id: '1', goal_id: 'g1', user_id: 'u1', date: '2026-04-30', completed: true, created_at: '' },
      { id: '2', goal_id: 'g1', user_id: 'u1', date: '2026-05-01', completed: true, created_at: '' },
      { id: '3', goal_id: 'g1', user_id: 'u1', date: '2026-05-02', completed: true, created_at: '' },
    ]
    expect(getCurrentStreak(baseGoal('daily'), checkIns, '2026-05-02')).toBe(3)
  })

  it('stops at a missed day', () => {
    // Apr 30 missed, May 1+2 done → streak = 2
    const checkIns: CheckIn[] = [
      { id: '2', goal_id: 'g1', user_id: 'u1', date: '2026-05-01', completed: true, created_at: '' },
      { id: '3', goal_id: 'g1', user_id: 'u1', date: '2026-05-02', completed: true, created_at: '' },
    ]
    expect(getCurrentStreak(baseGoal('daily'), checkIns, '2026-05-02')).toBe(2)
  })

  it('counts only scheduled days for a scheduled goal', () => {
    // Sunday-only goal, 3 consecutive Sundays completed
    const goal: Goal = { ...baseGoal('daily'), schedule_days: [0], catch_up: false }
    const checkIns: CheckIn[] = [
      { id: '1', goal_id: 'g1', user_id: 'u1', date: '2026-04-19', completed: true, created_at: '' },
      { id: '2', goal_id: 'g1', user_id: 'u1', date: '2026-04-26', completed: true, created_at: '' },
      { id: '3', goal_id: 'g1', user_id: 'u1', date: '2026-05-03', completed: true, created_at: '' },
    ]
    // Today is 2026-05-03 (Sunday) → streak = 3
    expect(getCurrentStreak(goal, checkIns, '2026-05-03')).toBe(3)
  })

  it('breaks streak when a scheduled day was missed', () => {
    // Sunday-only goal, missed 2026-04-26, but did 2026-05-03
    const goal: Goal = { ...baseGoal('daily'), schedule_days: [0], catch_up: false }
    const checkIns: CheckIn[] = [
      { id: '3', goal_id: 'g1', user_id: 'u1', date: '2026-05-03', completed: true, created_at: '' },
    ]
    expect(getCurrentStreak(goal, checkIns, '2026-05-03')).toBe(1)
  })
})
