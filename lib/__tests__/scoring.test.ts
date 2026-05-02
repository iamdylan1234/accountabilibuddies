import {
  scoreGoal, scoreChallenge, getWeekStart,
  isGoalActiveToday, isGoalCatchUp, getCurrentStreak,
} from '../scoring'
import type { Goal, CheckIn } from '@/types/database'

const baseGoal = (type: Goal['type'], target_count: number | null = null): Goal => ({
  id: 'g1', challenge_id: 'c1', user_id: 'u1',
  title: 'Test', type, target_count, created_at: '',
  target_unit: null, schedule_dates: null, catch_up: false,
})

const ci = (date: string, goalId = 'g1'): CheckIn => ({
  id: date, goal_id: goalId, user_id: 'u1', date, completed: true, value: null, created_at: '',
})

describe('scoreGoal', () => {
  it('daily: completions / totalDays', () => {
    expect(scoreGoal(baseGoal('daily'), [ci('2026-05-01'), ci('2026-05-02')], 10))
      .toBeCloseTo(0.2)
  })

  it('daily: uses elapsed days when startDate+today provided', () => {
    // 5 days elapsed (May 1–5), 2 completions → 2/5 = 0.4
    expect(scoreGoal(baseGoal('daily'), [ci('2026-05-01'), ci('2026-05-03')], 30, '2026-05-01', '2026-05-05'))
      .toBeCloseTo(0.4)
  })

  it('milestone: 1 if done, 0 if not', () => {
    expect(scoreGoal(baseGoal('milestone'), [ci('2026-05-01')], 30)).toBe(1)
    expect(scoreGoal(baseGoal('milestone'), [], 30)).toBe(0)
  })

  it('frequency without dates: completions / target_count', () => {
    expect(scoreGoal(baseGoal('frequency', 10), Array.from({length: 7}, (_, i) => ci(`2026-05-0${i+1}`)), 30))
      .toBeCloseTo(0.7)
  })

  it('frequency with schedule_dates: completions / past dates', () => {
    const goal: Goal = { ...baseGoal('frequency', 4), schedule_dates: ['2026-05-01','2026-05-05','2026-05-10','2026-05-15'] }
    // today = May 6, past dates = [May 1, May 5] = 2. 1 completion → 0.5
    expect(scoreGoal(goal, [ci('2026-05-01')], 30, '2026-05-01', '2026-05-06')).toBeCloseTo(0.5)
  })

  it('caps at 1', () => {
    expect(scoreGoal(baseGoal('frequency', 3), [ci('2026-05-01'), ci('2026-05-02'), ci('2026-05-03'), ci('2026-05-04')], 30)).toBe(1)
  })
})

describe('scoreChallenge', () => {
  it('average of goal scores as percentage', () => {
    const goals: Goal[] = [baseGoal('milestone'), { ...baseGoal('milestone'), id: 'g2' }]
    expect(scoreChallenge(goals, [ci('2026-05-01')], 30)).toBe(50)
  })

  it('returns 0 for empty goals', () => {
    expect(scoreChallenge([], [], 30)).toBe(0)
  })
})

describe('getWeekStart', () => {
  it('returns Monday given a Monday', () => {
    expect(getWeekStart(new Date(2026, 3, 27))).toEqual(new Date(2026, 3, 27))
  })

  it('returns previous Monday given a Wednesday', () => {
    expect(getWeekStart(new Date(2026, 3, 29))).toEqual(new Date(2026, 3, 27))
  })

  it('returns previous Monday given a Sunday', () => {
    expect(getWeekStart(new Date(2026, 4, 3))).toEqual(new Date(2026, 3, 27))
  })
})

describe('isGoalActiveToday', () => {
  it('daily (no dates): always true', () => {
    expect(isGoalActiveToday(baseGoal('daily'), '2026-05-05', [])).toBe(true)
  })

  it('frequency: true when today is a scheduled date', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-05', '2026-05-12'] }
    expect(isGoalActiveToday(goal, '2026-05-05', [])).toBe(true)
  })

  it('frequency: false when today is not scheduled and catch_up=false', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-03', '2026-05-10'], catch_up: false }
    expect(isGoalActiveToday(goal, '2026-05-06', [])).toBe(false)
  })

  it('frequency: true when catch_up=true and behind', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-03', '2026-05-10'], catch_up: true }
    // May 3 has passed, no completions → behind
    expect(isGoalActiveToday(goal, '2026-05-06', [])).toBe(true)
  })

  it('frequency: false when catch_up=true but not behind', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-03', '2026-05-10'], catch_up: true }
    expect(isGoalActiveToday(goal, '2026-05-06', [ci('2026-05-03')])).toBe(false)
  })
})

describe('isGoalCatchUp', () => {
  it('false when no schedule', () => {
    expect(isGoalCatchUp({ ...baseGoal('daily'), catch_up: true }, '2026-05-06', [])).toBe(false)
  })

  it('false when today IS a scheduled date', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-06'], catch_up: true }
    expect(isGoalCatchUp(goal, '2026-05-06', [])).toBe(false)
  })

  it('true when a past scheduled date was missed', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-03', '2026-05-10'], catch_up: true }
    expect(isGoalCatchUp(goal, '2026-05-06', [])).toBe(true)
  })

  it('false when caught up', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-03', '2026-05-10'], catch_up: true }
    expect(isGoalCatchUp(goal, '2026-05-06', [ci('2026-05-03')])).toBe(false)
  })
})

describe('getCurrentStreak', () => {
  it('returns 0 with no check-ins', () => {
    expect(getCurrentStreak(baseGoal('daily'), [], '2026-05-05')).toBe(0)
  })

  it('counts consecutive calendar days for daily goal', () => {
    const checkIns = [ci('2026-05-03'), ci('2026-05-04'), ci('2026-05-05')]
    expect(getCurrentStreak(baseGoal('daily'), checkIns, '2026-05-05')).toBe(3)
  })

  it('breaks on a missed calendar day', () => {
    // May 03 missing
    expect(getCurrentStreak(baseGoal('daily'), [ci('2026-05-04'), ci('2026-05-05')], '2026-05-05')).toBe(2)
  })

  it('counts consecutive schedule_dates for frequency goal', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-01','2026-05-05','2026-05-10'] }
    // today = May 07 → past dates = [May 1, May 5]. Both done → streak 2
    expect(getCurrentStreak(goal, [ci('2026-05-01'), ci('2026-05-05')], '2026-05-07')).toBe(2)
  })

  it('breaks on a missed schedule_date', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-01','2026-05-05','2026-05-10'] }
    // May 01 missed, May 05 done → streak 1
    expect(getCurrentStreak(goal, [ci('2026-05-05')], '2026-05-07')).toBe(1)
  })
})

describe('scoreGoal — cumulative', () => {
  it('sums check-in values against target_count', () => {
    const goal: Goal = { ...baseGoal('cumulative', 100), target_unit: 'km' }
    const checkIns: CheckIn[] = [
      { id: '1', goal_id: 'g1', user_id: 'u1', date: '2026-05-01', completed: true, value: 7.5, created_at: '' },
      { id: '2', goal_id: 'g1', user_id: 'u1', date: '2026-05-03', completed: true, value: 12.0, created_at: '' },
    ]
    expect(scoreGoal(goal, checkIns, 30)).toBeCloseTo(0.195) // 19.5/100
  })

  it('caps at 1 when over target', () => {
    const goal: Goal = { ...baseGoal('cumulative', 10), target_unit: 'km' }
    const checkIns: CheckIn[] = [
      { id: '1', goal_id: 'g1', user_id: 'u1', date: '2026-05-01', completed: true, value: 15, created_at: '' },
    ]
    expect(scoreGoal(goal, checkIns, 30)).toBe(1)
  })

  it('returns 0 when no target_count set', () => {
    const goal: Goal = { ...baseGoal('cumulative', null), target_unit: 'km' }
    expect(scoreGoal(goal, [], 30)).toBe(0)
  })

  it('scoreChallenge excludes cumulative goals from overall %', () => {
    const goals: Goal[] = [
      baseGoal('milestone'),                              // 0%
      { ...baseGoal('cumulative', 100), id: 'g2', target_unit: 'km' }, // excluded
    ]
    // Only milestone scored → 0/1 = 0%
    expect(scoreChallenge(goals, [], 30)).toBe(0)
  })
})
