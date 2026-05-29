import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import BuzzToggle from './BuzzToggle'

jest.mock('@/lib/push/useBuzzPermission', () => ({
  useBuzzPermission: jest.fn(),
}))
import { useBuzzPermission } from '@/lib/push/useBuzzPermission'

beforeEach(() => {
  ;(useBuzzPermission as jest.Mock).mockReset()
})

describe('BuzzToggle', () => {
  it('renders nothing when unsupported', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'unsupported' })
    const { container } = render(<BuzzToggle buddy={{ name: 'Sam Smith' } as any} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when ios-needs-install', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'ios-needs-install' })
    const { container } = render(<BuzzToggle buddy={{ name: 'Sam' } as any} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows "Off — tap to enable" when default', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'default', enable: jest.fn() })
    render(<BuzzToggle buddy={{ name: 'Sam Smith' } as any} />)
    expect(screen.getByText(/buddy buzzes/i)).toBeInTheDocument()
    expect(screen.getByText(/tap to enable/i)).toBeInTheDocument()
  })

  it('shows "On — buzzes from Sam" when granted + subscribed', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({
      kind: 'granted', subscribed: true, enable: jest.fn(), disable: jest.fn(),
    })
    render(<BuzzToggle buddy={{ name: 'Sam Smith' } as any} />)
    expect(screen.getByText(/on — buzzes from sam/i)).toBeInTheDocument()
  })

  it('shows "Blocked in browser settings" when denied', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'denied' })
    render(<BuzzToggle buddy={{ name: 'Sam' } as any} />)
    expect(screen.getByText(/blocked in browser settings/i)).toBeInTheDocument()
  })

  it('calls enable() when toggled from default', () => {
    const enable = jest.fn().mockResolvedValue(undefined)
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'default', enable })
    render(<BuzzToggle buddy={{ name: 'Sam' } as any} />)
    fireEvent.click(screen.getByRole('button', { name: /buddy buzzes/i }))
    expect(enable).toHaveBeenCalled()
  })

  it('calls disable() when toggled off from granted', () => {
    const disable = jest.fn().mockResolvedValue(undefined)
    ;(useBuzzPermission as jest.Mock).mockReturnValue({
      kind: 'granted', subscribed: true, enable: jest.fn(), disable,
    })
    render(<BuzzToggle buddy={{ name: 'Sam' } as any} />)
    fireEvent.click(screen.getByRole('button', { name: /buddy buzzes/i }))
    expect(disable).toHaveBeenCalled()
  })

  it('shows the failure reason when enabling fails (no more silent failure)', async () => {
    const enable = jest.fn().mockResolvedValue({ ok: false, reason: 'Notifications are blocked.' })
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'default', enable })
    render(<BuzzToggle buddy={{ name: 'Sam' } as any} />)
    fireEvent.click(screen.getByRole('button', { name: /buddy buzzes/i }))
    expect(await screen.findByText(/blocked/i)).toBeInTheDocument()
  })
})
