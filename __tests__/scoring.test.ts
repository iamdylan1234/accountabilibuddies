import {
  getWeekStart,
  isGoalActiveToday,
  isGoalCatchUp,
  getCurrentStreak,
  scoreGoal,
  scoreChallenge,
} from '@/lib/scoring'
import type { Goal, CheckIn } from '@/types/database'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    challenge_id: 'c1',
    user_id: 'u1',
    title: 'Test Goal',
    type: 'daily',
    target_count: null,
    target_unit: null,
    schedule_dates: null,
    catch_up: false,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeCheckIn(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    id: 'ci1',
    goal_id: 'g1',
    user_id: 'u1',
    date: '2026-05-05',
    completed: true,
    value: null,
    created_at: '2026-05-05T00:00:00Z',
    ...overrides,
  }
}

// ─── getWeekStart ─────────────────────────────────────────────────────────────

describe('getWeekStart', () => {
  test('Monday returns the same date', () => {
    const monday = new Date(2026, 4, 4) // Mon 4 May 2026
    const result = getWeekStart(monday)
    expect(result).toEqual(new Date(2026, 4, 4))
  })

  test('Tuesday returns the previous Monday', () => {
    const tuesday = new Date(2026, 4, 5) // Tue 5 May 2026
    expect(getWeekStart(tuesday)).toEqual(new Date(2026, 4, 4))
  })

  test('Sunday returns the Monday six days earlier', () => {
    const sunday = new Date(2026, 4, 10) // Sun 10 May 2026
    expect(getWeekStart(sunday)).toEqual(new Date(2026, 4, 4))
  })

  test('Saturday returns the Monday five days earlier', () => {
    const saturday = new Date(2026, 4, 9) // Sat 9 May 2026
    expect(getWeekStart(saturday)).toEqual(new Date(2026, 4, 4))
  })

  test('handles year boundary correctly', () => {
    const wednesday = new Date(2026, 11, 30) // Wed 30 Dec 2026
    expect(getWeekStart(wednesday)).toEqual(new Date(2026, 11, 28)) // Mon 28 Dec
  })
})

// ─── isGoalActiveToday ────────────────────────────────────────────────────────

describe('isGoalActiveToday', () => {
  test('no schedule_dates → always active', () => {
    const g = makeGoal({ schedule_dates: null })
    expect(isGoalActiveToday(g, '2026-05-05', [])).toBe(true)
  })

  test('empty schedule_dates → always active', () => {
    const g = makeGoal({ schedule_dates: [] })
    expect(isGoalActiveToday(g, '2026-05-05', [])).toBe(true)
  })

  test('today in schedule_dates → active', () => {
    const g = makeGoal({ schedule_dates: ['2026-05-05', '2026-05-07'] })
    expect(isGoalActiveToday(g, '2026-05-05', [])).toBe(true)
  })

  test('today not in schedule_dates, catch_up=false → not active', () => {
    const g = makeGoal({ schedule_dates: ['2026-05-03', '2026-05-07'], catch_up: false })
    expect(isGoalActiveToday(g, '2026-05-05', [])).toBe(false)
  })

  test('today not scheduled, catch_up=true, all past completed → not active', () => {
    const g = makeGoal({
      schedule_dates: ['2026-05-03', '2026-05-07'],
      catch_up: true,
    })
    const checkIns = [makeCheckIn({ date: '2026-05-03', completed: true })]
    expect(isGoalActiveToday(g, '2026-05-05', checkIns)).toBe(false)
  })

  test('today not scheduled, catch_up=true, past date missed → active (catch-up)', () => {
    const g = makeGoal({
      schedule_dates: ['2026-05-03', '2026-05-07'],
      catch_up: true,
    })
    expect(isGoalActiveToday(g, '2026-05-05', [])).toBe(true)
  })
})

// ─── isGoalCatchUp ────────────────────────────────────────────────────────────

describe('isGoalCatchUp', () => {
  test('catch_up=false → never catch-up', () => {
    const g = makeGoal({ schedule_dates: ['2026-05-03'], catch_up: false })
    expect(isGoalCatchUp(g, '2026-05-05', [])).toBe(false)
  })

  test('no schedule_dates → never catch-up', () => {
    const g = makeGoal({ schedule_dates: null, catch_up: true })
    expect(isGoalCatchUp(g, '2026-05-05', [])).toBe(false)
  })

  test('today is a scheduled date → not catch-up', () => {
    const g = makeGoal({ schedule_dates: ['2026-05-05'], catch_up: true })
    expect(isGoalCatchUp(g, '2026-05-05', [])).toBe(false)
  })

  test('past date missed, today unscheduled, catch_up=true → catch-up', () => {
    const g = makeGoal({
      schedule_dates: ['2026-05-03', '2026-05-07'],
      catch_up: true,
    })
    expect(isGoalCatchUp(g, '2026-05-05', [])).toBe(true)
  })

  test('past date completed, nothing missed → not catch-up', () => {
    const g = makeGoal({
      schedule_dates: ['2026-05-03', '2026-05-07'],
      catch_up: true,
    })
    const checkIns = [makeCheckIn({ date: '2026-05-03', completed: true })]
    expect(isGoalCatchUp(g, '2026-05-05', checkIns)).toBe(false)
  })

  test('two past dates, one done, one missed → catch-up', () => {
    const g = makeGoal({
      schedule_dates: ['2026-05-01', '2026-05-03', '2026-05-07'],
      catch_up: true,
    })
    const checkIns = [makeCheckIn({ date: '2026-05-01', completed: true })]
    // May 3 is past and not done → catch-up
    expect(isGoalCatchUp(g, '2026-05-05', checkIns)).toBe(true)
  })
})

// ─── getCurrentStreak ─────────────────────────────────────────────────────────

describe('getCurrentStreak', () => {
  describe('daily goals (no schedule_dates)', () => {
    const g = makeGoal({ type: 'daily', schedule_dates: null })

    test('no check-ins → streak 0', () => {
      expect(getCurrentStreak(g, [], '2026-05-05')).toBe(0)
    })

    test('done today only → streak 1', () => {
      const checkIns = [makeCheckIn({ date: '2026-05-05' })]
      expect(getCurrentStreak(g, checkIns, '2026-05-05')).toBe(1)
    })

    test('done today and yesterday → streak 2', () => {
      const checkIns = [
        makeCheckIn({ date: '2026-05-05' }),
        makeCheckIn({ id: 'ci2', date: '2026-05-04' }),
      ]
      expect(getCurrentStreak(g, checkIns, '2026-05-05')).toBe(2)
    })

    test('done today and 3 consecutive days → streak 4', () => {
      const checkIns = ['2026-05-05', '2026-05-04', '2026-05-03', '2026-05-02'].map(
        (date, i) => makeCheckIn({ id: `ci${i}`, date })
      )
      expect(getCurrentStreak(g, checkIns, '2026-05-05')).toBe(4)
    })

    test('gap in streak resets count', () => {
      // Done today and 3 days ago, but not yesterday or 2 days ago
      const checkIns = [
        makeCheckIn({ id: 'ci1', date: '2026-05-05' }),
        makeCheckIn({ id: 'ci2', date: '2026-05-02' }),
      ]
      expect(getCurrentStreak(g, checkIns, '2026-05-05')).toBe(1)
    })

    test('done yesterday but not today → streak 0', () => {
      const checkIns = [makeCheckIn({ date: '2026-05-04' })]
      expect(getCurrentStreak(g, checkIns, '2026-05-05')).toBe(0)
    })
  })

  describe('frequency goals (with schedule_dates)', () => {
    test('all scheduled dates completed → streak equals count', () => {
      const g = makeGoal({
        type: 'frequency',
        schedule_dates: ['2026-05-01', '2026-05-03', '2026-05-05'],
      })
      const checkIns = ['2026-05-01', '2026-05-03', '2026-05-05'].map(
        (date, i) => makeCheckIn({ id: `ci${i}`, date })
      )
      expect(getCurrentStreak(g, checkIns, '2026-05-05')).toBe(3)
    })

    test('most recent scheduled date missed → streak 0', () => {
      const g = makeGoal({
        type: 'frequency',
        schedule_dates: ['2026-05-01', '2026-05-03', '2026-05-05'],
      })
      // Done May 1 and 3, not May 5
      const checkIns = [
        makeCheckIn({ id: 'ci1', date: '2026-05-01' }),
        makeCheckIn({ id: 'ci2', date: '2026-05-03' }),
      ]
      expect(getCurrentStreak(g, checkIns, '2026-05-05')).toBe(0)
    })

    test('recent dates done, older one missed → partial streak', () => {
      const g = makeGoal({
        type: 'frequency',
        schedule_dates: ['2026-05-01', '2026-05-03', '2026-05-05'],
      })
      // Done May 5 and 3, not May 1
      const checkIns = [
        makeCheckIn({ id: 'ci1', date: '2026-05-05' }),
        makeCheckIn({ id: 'ci2', date: '2026-05-03' }),
      ]
      expect(getCurrentStreak(g, checkIns, '2026-05-05')).toBe(2)
    })
  })
})

// ─── scoreGoal ────────────────────────────────────────────────────────────────

describe('scoreGoal', () => {
  describe('milestone', () => {
    const g = makeGoal({ type: 'milestone' })

    test('completed → 1', () => {
      expect(scoreGoal(g, [makeCheckIn()], 31)).toBe(1)
    })

    test('not completed → 0', () => {
      expect(scoreGoal(g, [], 31)).toBe(0)
    })
  })

  describe('cumulative', () => {
    test('no target_count → 0', () => {
      const g = makeGoal({ type: 'cumulative', target_count: null })
      const checkIns = [makeCheckIn({ value: 10 })]
      expect(scoreGoal(g, checkIns, 31)).toBe(0)
    })

    test('logged value below target → partial score', () => {
      const g = makeGoal({ type: 'cumulative', target_count: 100 })
      const checkIns = [makeCheckIn({ value: 50 })]
      expect(scoreGoal(g, checkIns, 31)).toBe(0.5)
    })

    test('logged value at target → 1', () => {
      const g = makeGoal({ type: 'cumulative', target_count: 100 })
      const checkIns = [makeCheckIn({ value: 100 })]
      expect(scoreGoal(g, checkIns, 31)).toBe(1)
    })

    test('logged value exceeds target → capped at 1', () => {
      const g = makeGoal({ type: 'cumulative', target_count: 100 })
      const checkIns = [makeCheckIn({ value: 150 })]
      expect(scoreGoal(g, checkIns, 31)).toBe(1)
    })

    test('sums values across multiple check-ins', () => {
      const g = makeGoal({ type: 'cumulative', target_count: 100 })
      const checkIns = [
        makeCheckIn({ id: 'ci1', date: '2026-05-01', value: 30 }),
        makeCheckIn({ id: 'ci2', date: '2026-05-02', value: 25 }),
        makeCheckIn({ id: 'ci3', date: '2026-05-03', value: 20 }),
      ]
      expect(scoreGoal(g, checkIns, 31)).toBe(0.75)
    })
  })

  describe('daily', () => {
    const g = makeGoal({ type: 'daily' })

    test('useTargetCount=true: denominator is totalDays', () => {
      // 3 done out of 31-day challenge
      const checkIns = [1, 2, 3].map(i => makeCheckIn({ id: `ci${i}`, date: `2026-05-0${i}` }))
      expect(scoreGoal(g, checkIns, 31, '2026-05-01', '2026-05-31', true)).toBeCloseTo(3 / 31)
    })

    test('useTargetCount=false: denominator is elapsed days', () => {
      // 3 done, 5 days elapsed (May 1–5)
      const checkIns = [1, 2, 3].map(i => makeCheckIn({ id: `ci${i}`, date: `2026-05-0${i}` }))
      expect(scoreGoal(g, checkIns, 31, '2026-05-01', '2026-05-05', false)).toBeCloseTo(3 / 5)
    })

    test('zero elapsed days → 0 (no division by zero)', () => {
      expect(scoreGoal(g, [], 31, '2026-05-05', '2026-05-05', false)).toBe(0)
    })

    test('perfect score: done every elapsed day', () => {
      const checkIns = ['2026-05-01', '2026-05-02', '2026-05-03'].map(
        (date, i) => makeCheckIn({ id: `ci${i}`, date })
      )
      expect(scoreGoal(g, checkIns, 31, '2026-05-01', '2026-05-03', false)).toBe(1)
    })
  })

  describe('frequency', () => {
    test('useTargetCount=false: scores against past scheduled dates in window', () => {
      const g = makeGoal({
        type: 'frequency',
        target_count: 12,
        schedule_dates: ['2026-05-01', '2026-05-03', '2026-05-05', '2026-05-07'],
      })
      // 2 done out of 3 past scheduled (May 1, 3, 5 are past; May 7 is future)
      const checkIns = [
        makeCheckIn({ id: 'ci1', date: '2026-05-01' }),
        makeCheckIn({ id: 'ci2', date: '2026-05-03' }),
      ]
      expect(scoreGoal(g, checkIns, 31, '2026-05-01', '2026-05-05', false)).toBeCloseTo(2 / 3)
    })

    test('useTargetCount=true: scores against target_count', () => {
      const g = makeGoal({
        type: 'frequency',
        target_count: 12,
        schedule_dates: ['2026-05-01', '2026-05-03', '2026-05-05'],
      })
      const checkIns = [
        makeCheckIn({ id: 'ci1', date: '2026-05-01' }),
        makeCheckIn({ id: 'ci2', date: '2026-05-03' }),
      ]
      // 2 done out of target 12
      expect(scoreGoal(g, checkIns, 31, '2026-05-01', '2026-05-05', true)).toBeCloseTo(2 / 12)
    })

    test('no schedule_dates → falls back to target_count denominator', () => {
      const g = makeGoal({ type: 'frequency', target_count: 5, schedule_dates: null })
      const checkIns = [
        makeCheckIn({ id: 'ci1', date: '2026-05-01' }),
        makeCheckIn({ id: 'ci2', date: '2026-05-02' }),
        makeCheckIn({ id: 'ci3', date: '2026-05-03' }),
      ]
      expect(scoreGoal(g, checkIns, 31)).toBeCloseTo(3 / 5)
    })

    test('no past scheduled dates in window → 0', () => {
      const g = makeGoal({
        type: 'frequency',
        target_count: 4,
        schedule_dates: ['2026-05-10', '2026-05-12'], // all future
      })
      expect(scoreGoal(g, [], 31, '2026-05-01', '2026-05-05', false)).toBe(0)
    })

    test('score capped at 1 even with extra completions', () => {
      const g = makeGoal({
        type: 'frequency',
        target_count: 2,
        schedule_dates: ['2026-05-01', '2026-05-03'],
      })
      const checkIns = [
        makeCheckIn({ id: 'ci1', date: '2026-05-01' }),
        makeCheckIn({ id: 'ci2', date: '2026-05-03' }),
      ]
      expect(scoreGoal(g, checkIns, 31, '2026-05-01', '2026-05-03', false)).toBe(1)
    })
  })
})

// ─── scoreChallenge ───────────────────────────────────────────────────────────

describe('scoreChallenge', () => {
  test('no goals → 0', () => {
    expect(scoreChallenge([], [], 31)).toBe(0)
  })

  test('cumulative goals are excluded from scoring', () => {
    const g = makeGoal({ type: 'cumulative', target_count: 100 })
    const checkIns = [makeCheckIn({ value: 100 })]
    // Only cumulative goal — no scorable goals → 0
    expect(scoreChallenge([g], checkIns, 31)).toBe(0)
  })

  test('single daily goal, perfect score → 100', () => {
    const g = makeGoal({ type: 'daily' })
    const checkIns = ['2026-05-01', '2026-05-02', '2026-05-03'].map(
      (date, i) => makeCheckIn({ id: `ci${i}`, date })
    )
    expect(scoreChallenge([g], checkIns, 31, '2026-05-01', '2026-05-03', false)).toBe(100)
  })

  test('averages across multiple goals and rounds', () => {
    // Goal 1 (daily): 1/2 elapsed = 50%
    // Goal 2 (milestone): done = 100%
    // Average = 75%
    const g1 = makeGoal({ id: 'g1', type: 'daily' })
    const g2 = makeGoal({ id: 'g2', type: 'milestone' })
    const checkIns = [
      makeCheckIn({ id: 'ci1', goal_id: 'g1', date: '2026-05-01' }),
      makeCheckIn({ id: 'ci2', goal_id: 'g2', date: '2026-05-01' }),
    ]
    expect(scoreChallenge([g1, g2], checkIns, 31, '2026-05-01', '2026-05-02', false)).toBe(75)
  })

  test('cumulative goal alongside scorable goals does not affect score', () => {
    const daily = makeGoal({ id: 'g1', type: 'daily' })
    const cumulative = makeGoal({ id: 'g2', type: 'cumulative', target_count: 100 })
    const checkIns = [
      makeCheckIn({ id: 'ci1', goal_id: 'g1', date: '2026-05-01' }),
      makeCheckIn({ id: 'ci2', goal_id: 'g2', date: '2026-05-01', value: 100 }),
    ]
    // Only daily goal scored: 1/1 elapsed = 100
    expect(scoreChallenge([daily, cumulative], checkIns, 31, '2026-05-01', '2026-05-01', false)).toBe(100)
  })

  test('useTargetCount=true uses full challenge length for daily goals', () => {
    const g = makeGoal({ type: 'daily' })
    // 1 done out of 31-day challenge = ~3%
    const checkIns = [makeCheckIn({ date: '2026-05-01' })]
    expect(scoreChallenge([g], checkIns, 31, '2026-05-01', '2026-05-31', true)).toBe(Math.round((1 / 31) * 100))
  })
})
