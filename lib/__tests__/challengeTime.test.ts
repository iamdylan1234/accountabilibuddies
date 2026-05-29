import {
  isValidTimeZone, zonedMidnightUtc, challengeCompletionInstant, isChallengeOver,
} from '../challengeTime'

describe('isValidTimeZone', () => {
  it('accepts real IANA zones', () => {
    expect(isValidTimeZone('UTC')).toBe(true)
    expect(isValidTimeZone('America/New_York')).toBe(true)
    expect(isValidTimeZone('Europe/Amsterdam')).toBe(true)
  })
  it('rejects junk and empty', () => {
    expect(isValidTimeZone('Not/AZone')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
  })
})

describe('zonedMidnightUtc', () => {
  it('UTC midnight is itself', () => {
    expect(zonedMidnightUtc('2026-06-01', 'UTC').toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })
  it('null timezone is treated as UTC', () => {
    expect(zonedMidnightUtc('2026-06-01', null).toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })
  it('America/New_York summer midnight is 04:00 UTC (EDT, UTC-4)', () => {
    expect(zonedMidnightUtc('2026-06-01', 'America/New_York').toISOString()).toBe('2026-06-01T04:00:00.000Z')
  })
  it('America/New_York winter midnight is 05:00 UTC (EST, UTC-5) — DST aware', () => {
    expect(zonedMidnightUtc('2026-01-01', 'America/New_York').toISOString()).toBe('2026-01-01T05:00:00.000Z')
  })
  it('Asia/Tokyo midnight is previous-day 15:00 UTC (UTC+9)', () => {
    expect(zonedMidnightUtc('2026-06-01', 'Asia/Tokyo').toISOString()).toBe('2026-05-31T15:00:00.000Z')
  })
})

describe('challengeCompletionInstant', () => {
  it('null/null = UTC midnight after end_date', () => {
    expect(challengeCompletionInstant('2026-05-31', null, null).toISOString())
      .toBe('2026-06-01T00:00:00.000Z')
  })
  it('takes the LATER (westmost) of the two midnights', () => {
    expect(challengeCompletionInstant('2026-05-31', 'Asia/Tokyo', 'America/Los_Angeles').toISOString())
      .toBe('2026-06-01T07:00:00.000Z')
  })
  it('is order-independent', () => {
    expect(challengeCompletionInstant('2026-05-31', 'America/Los_Angeles', 'Asia/Tokyo').toISOString())
      .toBe('2026-06-01T07:00:00.000Z')
  })
})

describe('isChallengeOver', () => {
  const end = '2026-05-31'
  it('false just before the later midnight', () => {
    expect(isChallengeOver(new Date('2026-06-01T06:59:59.000Z'), end, 'Asia/Tokyo', 'America/Los_Angeles'))
      .toBe(false)
  })
  it('true at/after the later midnight', () => {
    expect(isChallengeOver(new Date('2026-06-01T07:00:00.000Z'), end, 'Asia/Tokyo', 'America/Los_Angeles'))
      .toBe(true)
  })
  it('UTC pair: over exactly at 00:00 the day after end_date', () => {
    expect(isChallengeOver(new Date('2026-06-01T00:00:00.000Z'), end, null, null)).toBe(true)
    expect(isChallengeOver(new Date('2026-05-31T23:59:59.000Z'), end, null, null)).toBe(false)
  })
})
