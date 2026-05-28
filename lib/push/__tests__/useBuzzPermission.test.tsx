import { renderHook, act, waitFor } from '@testing-library/react'
import { useBuzzPermission } from '../useBuzzPermission'

const originalNotification = (global as any).Notification

afterEach(() => {
  ;(global as any).Notification = originalNotification
  delete (window as any).PushManager
})

// Sets up a fully push-capable environment. Provides:
//  - Notification with a permission + a working requestPermission mock
//  - window.PushManager stub (supportsPush() checks `'PushManager' in window`)
//  - navigator.serviceWorker.ready resolving a pushManager with subscribe/getSubscription
//  - matchMedia for standalone detection, userAgent for iOS detection
function mockPushSupport({
  permission = 'default' as NotificationPermission,
  existingSubscription = null as null | { endpoint: string },
  standalone = true, // PWA-installed
  isIOS = false,
}) {
  ;(global as any).Notification = {
    permission,
    requestPermission: jest.fn().mockResolvedValue('granted'),
  }
  ;(window as any).PushManager = class {}

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

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({
      matches: q.includes('standalone') ? standalone : false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })

  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: isIOS ? 'iPhone Safari' : 'Android Chrome',
  })

  return { mockSubscribe, mockGetSubscription, mockUnsub }
}

describe('useBuzzPermission', () => {
  it('returns "unsupported" when push APIs are unavailable', async () => {
    // Remove the feature-detected globals entirely so the `in` checks fail.
    delete (global as any).Notification
    delete (window as any).PushManager
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
    // Valid base64url VAPID key (87 chars -> 65-byte P-256 point) so the real
    // urlBase64ToUint8Array decoder runs without throwing.
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'B' + 'a'.repeat(86)
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
