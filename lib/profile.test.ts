import { firstNameOf } from './profile'

describe('firstNameOf', () => {
  it('returns the substring before the first space', () => {
    expect(firstNameOf({ name: 'Dylan Rogers' })).toBe('Dylan')
  })

  it('returns the whole string when there is no space', () => {
    expect(firstNameOf({ name: 'Dylan' })).toBe('Dylan')
  })

  it('falls back to "Your buddy" when name is null', () => {
    expect(firstNameOf({ name: null })).toBe('Your buddy')
  })

  it('falls back to "Your buddy" when name is empty string', () => {
    expect(firstNameOf({ name: '' })).toBe('Your buddy')
  })

  it('falls back to "Your buddy" when name is whitespace only', () => {
    expect(firstNameOf({ name: '   ' })).toBe('Your buddy')
  })

  it('falls back to "Your buddy" when input is null', () => {
    expect(firstNameOf(null)).toBe('Your buddy')
  })

  it('trims leading whitespace before splitting', () => {
    expect(firstNameOf({ name: '  Dylan Rogers' })).toBe('Dylan')
  })
})
