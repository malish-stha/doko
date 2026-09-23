import { describe, expect, test } from 'vitest'
import { isValidTimezone, localDateString, localHour, startOfLocalDay } from './time'

describe('time helpers', () => {
  const instant = new Date('2026-09-23T03:30:00Z')

  test('localDateString and localHour follow the zone, not the server locale', () => {
    expect(localDateString('UTC', instant)).toBe('2026-09-23')
    expect(localDateString('America/Los_Angeles', instant)).toBe('2026-09-22') // 20:30 the day before
    expect(localDateString('Asia/Kathmandu', instant)).toBe('2026-09-23') // 09:15
    expect(localHour('America/Los_Angeles', instant)).toBe(20)
    expect(localHour('Asia/Kathmandu', instant)).toBe(9)
    expect(localHour('UTC', new Date('2026-09-23T00:10:00Z'))).toBe(0)
  })

  test('startOfLocalDay returns local midnight as an instant', () => {
    expect(startOfLocalDay('2026-09-23', 'UTC')).toBe(Date.UTC(2026, 8, 23))
    // Kathmandu is UTC+5:45, so local midnight is 18:15 UTC the day before.
    expect(startOfLocalDay('2026-09-23', 'Asia/Kathmandu')).toBe(Date.UTC(2026, 8, 22, 18, 15))
    // PDT is UTC-7 in September.
    expect(startOfLocalDay('2026-09-23', 'America/Los_Angeles')).toBe(Date.UTC(2026, 8, 23, 7))
  })

  test('invalid zones are rejected by isValidTimezone and fall back to UTC elsewhere', () => {
    expect(isValidTimezone('Mars/Olympus')).toBe(false)
    expect(isValidTimezone('Europe/Berlin')).toBe(true)
    expect(localDateString('Mars/Olympus', instant)).toBe('2026-09-23')
  })
})
