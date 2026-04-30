import { scoreGoal, scoreChallenge } from '../scoring'
import type { Goal, CheckIn } from '@/types/database'

const baseGoal = (type: Goal['type'], target_count: number | null = null): Goal => ({
  id: 'g1', challenge_id: 'c1', user_id: 'u1',
  title: 'Test', type, target_count, created_at: '',
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
