// 날짜 계산 유틸(dateUtils.ts)을 검증한다. 월/연도 경계를 넘는 케이스가 많은 이유는, 일정에
// 날짜를 추가(addDay)하다 보면 실제로 월말/연말을 넘기는 경우가 흔하기 때문.
import { addDaysIso, formatItineraryDate, todayIso } from './dateUtils'

describe('addDaysIso', () => {
  it('adds days within the same month', () => {
    expect(addDaysIso('2026-07-25', 2)).toBe('2026-07-27')
  })

  it('returns the same date when adding zero days', () => {
    expect(addDaysIso('2026-07-25', 0)).toBe('2026-07-25')
  })

  it('rolls over into the next month', () => {
    expect(addDaysIso('2026-07-30', 3)).toBe('2026-08-02')
  })

  it('rolls over into the next year', () => {
    expect(addDaysIso('2026-12-30', 3)).toBe('2027-01-02')
  })

  describe('in a UTC-ahead timezone (e.g. Korea, UTC+9)', () => {
    beforeEach(() => {
      vi.stubEnv('TZ', 'Asia/Seoul')
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('does not shift the date backward when adding zero days', () => {
      expect(addDaysIso('2026-07-25', 0)).toBe('2026-07-25')
    })

    it('keeps day offsets consistent so a later addDaysIso call on the result still lands correctly', () => {
      const day1 = addDaysIso('2026-07-25', 0)
      const day3 = addDaysIso('2026-07-25', 2)
      // Simulates fetchDailyForecast computing its end date from day1 (an already-computed date).
      const recomputedEndDate = addDaysIso(day1, 2)
      expect(recomputedEndDate).toBe(day3)
    })
  })
})

describe('formatItineraryDate', () => {
  it('formats an ISO date into a Korean month/day/weekday string', () => {
    expect(formatItineraryDate('2026-07-25')).toBe('7월 25일 (토)')
  })

  it('formats a different date correctly', () => {
    expect(formatItineraryDate('2026-01-01')).toBe('1월 1일 (목)')
  })
})

describe('todayIso', () => {
  it('returns a date in YYYY-MM-DD format', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  describe('in a UTC-ahead timezone (e.g. Korea, UTC+9)', () => {
    beforeEach(() => {
      vi.stubEnv('TZ', 'Asia/Seoul')
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
      vi.useRealTimers()
    })

    it('returns the local calendar date, not the UTC date, near a day boundary', () => {
      // 2026-07-24 20:00 UTC is already 2026-07-25 05:00 in Korea.
      vi.setSystemTime(new Date('2026-07-24T20:00:00Z'))
      expect(todayIso()).toBe('2026-07-25')
    })
  })
})
