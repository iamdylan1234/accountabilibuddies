import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import WeekStrip from './WeekStrip'
import type { Goal, CheckIn } from '@/types/database'

const dailyGoal: Goal = {
  id: 'g1', challenge_id: 'c1', user_id: 'u1', title: 'Wake up',
  type: 'daily', target_count: null, target_unit: null,
  created_at: '', schedule_dates: null, catch_up: false,
}

describe('WeekStrip', () => {
  const baseProps = {
    weekStart: '2026-05-12',  // Monday
    today: '2026-05-15',      // Thursday
    challengeStart: '2026-05-12',
    challengeEnd: '2026-06-10',
    myGoals: [dailyGoal],
    buddyGoals: [{ ...dailyGoal, id: 'g2', user_id: 'u2' }],
    myCheckIns: [] as CheckIn[],
    buddyCheckIns: [] as CheckIn[],
    myName: 'You',
    buddyName: 'Josh',
    selectedDate: '2026-05-15',
    onSelectDay: jest.fn(),
  }

  it('renders 7 day-cell groups with day labels', () => {
    render(<WeekStrip {...baseProps} />)
    expect(screen.getByText('MON')).toBeInTheDocument()
    expect(screen.getByText('SUN')).toBeInTheDocument()
  })

  it('renders name labels for both rows', () => {
    render(<WeekStrip {...baseProps} />)
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Josh')).toBeInTheDocument()
  })

  it('calls onSelectDay with the tapped date', () => {
    const onSelectDay = jest.fn()
    render(<WeekStrip {...baseProps} onSelectDay={onSelectDay} />)
    // Tap the Tuesday cell (2026-05-13)
    fireEvent.click(screen.getByRole('button', { name: /tuesday.*may 13/i }))
    expect(onSelectDay).toHaveBeenCalledWith('2026-05-13')
  })

  it('does not fire onSelectDay for out-of-range days', () => {
    const onSelectDay = jest.fn()
    render(
      <WeekStrip
        {...baseProps}
        weekStart="2026-05-05"
        challengeStart="2026-05-12"
        onSelectDay={onSelectDay}
      />
    )
    // 2026-05-05 (Monday of this week) is BEFORE challenge start, should be unclickable
    const tueButton = screen.queryByRole('button', { name: /monday.*may 5/i })
    expect(tueButton).toBeNull()
  })
})
