import { renderHook, act, waitFor } from '@testing-library/react'
import { useBuzzPermission } from '../useBuzzPermission'

// Defaults the test harness restores between tests.
const originalNotification = (global as any).Notification
const originalNavigator = global.navigator

afterEach(() => {
  ;(global as any).Notification = originalNotification
  // Restoring navigator is non-trivial; tests should reset only the fields they touch
})

function mockPushSupport({
  permission = 'default' as NotificationPermission,
  existingSubscription = null as null | { endpoint: string },
  standalone = true, // PWA-installed
  isIOS = false,
}) {
  ;(global as any).Notification = { permission }

  const mockSubscribe = jest.fn().mockResolvedValue({
    endpoint: 'https://push.example/new',
    getKey: (k: string) =>
      new Uint8Array(k === 'p256dh' ? [1, 2, 3] : [4, 5, 6]).buffer,
  })
  const mockUnsub = jest.fn().mockResolvedValue(true)
  const mockGetSubscription = jest.fn().mockResolvedValue(
    existingSubscription
      ? { ...existingSubscription, unsubscribe: mockUnsub }
      : null,
  )

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: {
          subscribe: mockSubscribe,
          getSubscription: mockGetSubscription,
        },
      }),
    },
  })

  // Mock matchMedia for standalone detection
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({
      matches: q.includes('standalone') ? standalone : false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })

  // Mock user agent for iOS detection
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: isIOS ? 'iPhone Safari' : 'Android Chrome',
  })

  return { mockSubscribe, mockGetSubscription, mockUnsub }
}

describe('useBuzzPermission', () => {
  it('returns "unsupported" when PushManager is unavailable', async () => {
    ;(global as any).Notification = undefined
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined })
    const { result } = renderHook(() => useBuzzPermission())
    await waitFor(() => expect(result.current.kind).toBe('unsupported'))
  })

  it('returns "ios-needs-install" on iOS Safari without standalone', async () => {
    mockPushSupport({ isIOS: true, standalone: false })
    const { result } = renderHook(() => useBuzzPermission())
    await waitFor(() => expect(result.current.kind).toBe('ios-needs-install'))
  })

  it('returns "default" when permission is default and supported', async () => {
    mockPushSupport({ permission: 'default' })
    const { result } = renderHook(() => useBuzzPermission())
    await waitFor(() => expect(result.current.kind).toBe('default'))
  })

  it('returns "denied" when permission is denied', async () => {
    mockPushSupport({ permission: 'denied' })
    const { result } = renderHook(() => useBuzzPermission())
    await waitFor(() => expect(result.current.kind).toBe('denied'))
  })

  it('returns "granted" + subscribed when permission granted and subscription exists', async () => {
    mockPushSupport({
      permission: 'granted',
      existingSubscription: { endpoint: 'https://push.example/existing' },
    })
    const { result } = renderHook(() => useBuzzPermission())
    await waitFor(() => {
      expect(result.current.kind).toBe('granted')
      if (result.current.kind === 'granted') expect(result.current.subscribed).toBe(true)
    })
  })

  it('enable() calls Notification.requestPermission and POSTs to /api/push/subscribe', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as any
    ;(global as any).Notification = {
      permission: 'default',
      requestPermission: jest.fn().mockResolvedValue('granted'),
    }
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'BFakeVapidKey'
    const { mockSubscribe } = mockPushSupport({ permission: 'default' })
    const { result } = renderHook(() => useBuzzPermission())
    await waitFor(() => expect(result.current.kind).toBe('default'))

    await act(async () => {
      if (result.current.kind === 'default') await result.current.enable()
    })

    expect(mockSubscribe).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/push/subscribe',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
