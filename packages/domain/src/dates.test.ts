import { describe, expect, it } from 'vitest'
import { addDays, localDayKey, weekStartOf } from './dates'

describe('dates', () => {
  it('maps an instant to the local calendar day of a time zone', () => {
    expect(localDayKey('2026-01-01T23:30:00Z', 'Europe/Madrid')).toBe('2026-01-02')
    expect(localDayKey('2026-01-01T23:30:00Z', 'UTC')).toBe('2026-01-01')
    expect(localDayKey('2026-01-02T03:00:00Z', 'America/Mexico_City')).toBe('2026-01-01')
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('finds the start of the week for Monday and Sunday week starts', () => {
    // 2026-11-17 is a Tuesday
    expect(weekStartOf('2026-11-17', 'monday')).toBe('2026-11-16')
    expect(weekStartOf('2026-11-17', 'sunday')).toBe('2026-11-15')
    expect(weekStartOf('2026-11-15', 'monday')).toBe('2026-11-09')
    expect(weekStartOf('2026-11-15', 'sunday')).toBe('2026-11-15')
  })
})
