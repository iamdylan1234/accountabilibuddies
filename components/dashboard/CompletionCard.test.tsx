import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import CompletionCard from './CompletionCard'

const base = {
  challengeName: 'Accountability Arena',
  myName: 'Dylan',
  buddyName: 'Josh',
  myScore: 87,
  buddyScore: 81,
  result: 'won' as const,
}

describe('CompletionCard', () => {
  it('shows both scores and names', () => {
    render(<CompletionCard {...base} />)
    expect(screen.getByText('87%')).toBeInTheDocument()
    expect(screen.getByText('81%')).toBeInTheDocument()
    expect(screen.getByText('Dylan')).toBeInTheDocument()
    expect(screen.getByText('Josh')).toBeInTheDocument()
  })

  it('celebrates a win', () => {
    render(<CompletionCard {...base} result="won" />)
    expect(screen.getByText(/you won/i)).toBeInTheDocument()
  })

  it('names the buddy on a loss', () => {
    render(<CompletionCard {...base} result="lost" myScore={70} buddyScore={90} />)
    expect(screen.getByText(/josh won/i)).toBeInTheDocument()
  })

  it('shows a tie', () => {
    render(<CompletionCard {...base} result="tied" myScore={80} buddyScore={80} />)
    expect(screen.getByText(/tie/i)).toBeInTheDocument()
  })

  it('links to the full results on the Summary tab', () => {
    render(<CompletionCard {...base} />)
    const link = screen.getByRole('link', { name: /full results/i })
    expect(link).toHaveAttribute('href', '/wrap-up')
  })
})
