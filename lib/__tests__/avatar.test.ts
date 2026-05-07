import { getAvatarUrl } from '../avatar'

describe('getAvatarUrl', () => {
  it('builds a DiceBear URL with the given style and userId', () => {
    const url = getAvatarUrl('user-123', 'bottts')
    expect(url).toBe('https://api.dicebear.com/9.x/bottts/svg?seed=user-123')
  })

  it('defaults to avataaars when no style provided', () => {
    const url = getAvatarUrl('user-456')
    expect(url).toBe('https://api.dicebear.com/9.x/avataaars/svg?seed=user-456')
  })

  it('defaults to avataaars when style is empty string', () => {
    const url = getAvatarUrl('user-789', '')
    expect(url).toBe('https://api.dicebear.com/9.x/avataaars/svg?seed=user-789')
  })
})
