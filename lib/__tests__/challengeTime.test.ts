import {
  isValidTimeZone, zonedMidnightUtc, challengeCompletionInstant, isChallengeOver, hasChallengeStarted,
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
  it('rounds a non-existent midnight (spring-forward at 00:00) FORWARD, never to the previous day', () => {
    // America/Sao_Paulo historically sprang forward AT midnight (00:00→01:00) on 2018-11-04,
    // so 00:00 that day does not exist. The result must land on 2018-11-04 (the gap end),
    // never on 11-03 — otherwise the westmost buddy's final day would be cut short.
    const result = zonedMidnightUtc('2018-11-04', 'America/Sao_Paulo')
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(result)
    const p: Record<string, string> = {}
    for (const x of parts) p[x.type] = x.value
    expect(p.day).toBe('04')   // never 03 (the previous day)
    expect(p.hour).toBe('01')  // first valid instant after the non-existent 00:00
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

describe('hasChallengeStarted', () => {
  it('false the minute before the local start midnight (UTC)', () => {
    expect(hasChallengeStarted(new Date('2026-05-31T23:59:00Z'), '2026-06-01', 'UTC')).toBe(false)
  })
  it('true at exactly the local start midnight (UTC)', () => {
    expect(hasChallengeStarted(new Date('2026-06-01T00:00:00Z'), '2026-06-01', 'UTC')).toBe(true)
  })
  it('true after the local start midnight (UTC)', () => {
    expect(hasChallengeStarted(new Date('2026-06-02T12:00:00Z'), '2026-06-01', 'UTC')).toBe(true)
  })
  it('null tz behaves as UTC', () => {
    expect(hasChallengeStarted(new Date('2026-05-31T23:59:00Z'), '2026-06-01', null)).toBe(false)
    expect(hasChallengeStarted(new Date('2026-06-01T00:00:00Z'), '2026-06-01', null)).toBe(true)
  })
  it('Asia/Tokyo (UTC+9): starts 15:00 UTC the previous day', () => {
    expect(hasChallengeStarted(new Date('2026-05-31T14:59:00Z'), '2026-06-01', 'Asia/Tokyo')).toBe(false)
    expect(hasChallengeStarted(new Date('2026-05-31T15:00:00Z'), '2026-06-01', 'Asia/Tokyo')).toBe(true)
  })
  it('America/New_York (EDT, UTC-4): starts 04:00 UTC', () => {
    expect(hasChallengeStarted(new Date('2026-06-01T03:59:00Z'), '2026-06-01', 'America/New_York')).toBe(false)
    expect(hasChallengeStarted(new Date('2026-06-01T04:00:00Z'), '2026-06-01', 'America/New_York')).toBe(true)
  })
})
