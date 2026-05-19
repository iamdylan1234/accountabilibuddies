import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import WeekHeader from './WeekHeader'

describe('WeekHeader', () => {
  const baseProps = {
    weekStart: '2026-05-12',
    weekEnd: '2026-05-18',
    canGoPrev: true,
    canGoNext: true,
    onPrev: jest.fn(),
    onNext: jest.fn(),
  }

  it('renders the date range label', () => {
    render(<WeekHeader {...baseProps} />)
    expect(screen.getByText(/may 12.*–.*may 18/i)).toBeInTheDocument()
  })

  it('prev arrow is enabled when canGoPrev', () => {
    const onPrev = jest.fn()
    render(<WeekHeader {...baseProps} onPrev={onPrev} />)
    fireEvent.click(screen.getByLabelText(/previous week/i))
    expect(onPrev).toHaveBeenCalled()
  })

  it('next arrow is disabled when !canGoNext', () => {
    const onNext = jest.fn()
    render(<WeekHeader {...baseProps} canGoNext={false} onNext={onNext} />)
    const nextBtn = screen.getByLabelText(/next week/i)
    expect(nextBtn).toBeDisabled()
    fireEvent.click(nextBtn)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('prev arrow is disabled when !canGoPrev', () => {
    const onPrev = jest.fn()
    render(<WeekHeader {...baseProps} canGoPrev={false} onPrev={onPrev} />)
    const prevBtn = screen.getByLabelText(/previous week/i)
    expect(prevBtn).toBeDisabled()
    fireEvent.click(prevBtn)
    expect(onPrev).not.toHaveBeenCalled()
  })
})
