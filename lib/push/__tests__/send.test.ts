import { sendBuzz } from '../send'

// Mock the admin client + web-push
const mockSelect = jest.fn()
const mockDelete = jest.fn()
const mockEq = jest.fn()

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { name: 'Dylan Rogers' }, error: null }),
            }),
          }),
        }
      }
      if (table === 'push_subscriptions') {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              mockSelect(col, val)
              return Promise.resolve({
                data: [
                  { id: 'sub1', endpoint: 'https://push.example/1', p256dh: 'k1', auth: 'a1' },
                  { id: 'sub2', endpoint: 'https://push.example/2', p256dh: 'k2', auth: 'a2' },
                ],
                error: null,
              })
            },
          }),
          delete: () => ({
            eq: (col: string, val: string) => {
              mockDelete(col, val)
              return Promise.resolve({ error: null })
            },
          }),
        }
      }
      return {} as any
    },
  }),
}))

const mockSendNotification = jest.fn()
jest.mock('web-push', () => ({
  __esModule: true,
  default: {
    setVapidDetails: jest.fn(),
    sendNotification: (...args: any[]) => mockSendNotification(...args),
  },
}))

// Required env vars
process.env.VAPID_SUBJECT = 'mailto:test@test.com'
process.env.VAPID_PUBLIC_KEY = 'public'
process.env.VAPID_PRIVATE_KEY = 'private'

beforeEach(() => {
  mockSelect.mockClear()
  mockDelete.mockClear()
  mockSendNotification.mockClear()
})

describe('sendBuzz', () => {
  it('sends to every push subscription belonging to the recipient', async () => {
    mockSendNotification.mockResolvedValue(undefined)
    await sendBuzz('sender-id', 'recipient-id')
    expect(mockSendNotification).toHaveBeenCalledTimes(2)
  })

  it('includes the sender first name in the notification body', async () => {
    mockSendNotification.mockResolvedValue(undefined)
    await sendBuzz('sender-id', 'recipient-id')
    const payload = JSON.parse(mockSendNotification.mock.calls[0][1])
    expect(payload.body).toContain('Dylan')
    expect(payload.title).toBe('Accountabilibuddies')
  })

  it('does NOT include the daily_message content in the payload', async () => {
    mockSendNotification.mockResolvedValue(undefined)
    await sendBuzz('sender-id', 'recipient-id')
    const payload = JSON.parse(mockSendNotification.mock.calls[0][1])
    // Both title and body together
    const combined = `${payload.title} ${payload.body}`
    // The body should be the wrapper, not the message contents
    expect(combined).not.toMatch(/message:|wrote:|said:/i)
  })

  it('deletes a subscription when push returns 404', async () => {
    mockSendNotification
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockResolvedValueOnce(undefined)
    await sendBuzz('sender-id', 'recipient-id')
    expect(mockDelete).toHaveBeenCalledWith('id', 'sub1')
  })

  it('deletes a subscription when push returns 410', async () => {
    mockSendNotification
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockResolvedValueOnce(undefined)
    await sendBuzz('sender-id', 'recipient-id')
    expect(mockDelete).toHaveBeenCalledWith('id', 'sub1')
  })

  it('swallows non-404/410 errors and does NOT delete', async () => {
    mockSendNotification.mockRejectedValue({ statusCode: 500 })
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect(sendBuzz('sender-id', 'recipient-id')).resolves.toBeUndefined()
    expect(mockDelete).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
