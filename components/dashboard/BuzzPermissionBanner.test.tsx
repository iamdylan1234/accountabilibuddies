import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import BuzzPermissionBanner from './BuzzPermissionBanner'

// Mock the hook so we can drive state from tests
jest.mock('@/lib/push/useBuzzPermission', () => ({
  useBuzzPermission: jest.fn(),
}))
import { useBuzzPermission } from '@/lib/push/useBuzzPermission'

beforeEach(() => {
  ;(useBuzzPermission as jest.Mock).mockReset()
  localStorage.clear()
})

describe('BuzzPermissionBanner', () => {
  it('renders nothing when no buddy', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'default', enable: jest.fn() })
    const { container } = render(<BuzzPermissionBanner buddy={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when state is unsupported', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'unsupported' })
    const { container } = render(<BuzzPermissionBanner buddy={{ id: 'b', name: 'Sam Smith' } as any} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when state is ios-needs-install', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'ios-needs-install' })
    const { container } = render(<BuzzPermissionBanner buddy={{ id: 'b', name: 'Sam' } as any} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when already granted', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({
      kind: 'granted', subscribed: true, enable: jest.fn(), disable: jest.fn(),
    })
    const { container } = render(<BuzzPermissionBanner buddy={{ id: 'b', name: 'Sam' } as any} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders banner with buddy first name when default + buddy present', () => {
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'default', enable: jest.fn() })
    render(<BuzzPermissionBanner buddy={{ id: 'b', name: 'Sam Smith' } as any} />)
    expect(screen.getByText(/Sam sends a message/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enable/i })).toBeInTheDocument()
  })

  it('hides when recently dismissed', () => {
    localStorage.setItem(
      'accountabilibuddies-buzz-banner-dismissed-until',
      String(Date.now() + 1000 * 60 * 60 * 24),
    )
    ;(useBuzzPermission as jest.Mock).mockReturnValue({ kind: 'default', enable: jest.fn() })
    const { container } = render(<BuzzPermissionBanner buddy={{ id: 'b', name: 'Sam' } as any} />)
    expect(container.firstChild).toBeNull()
  })
})
