// activityCost.ts(활동별 실사용 비용 계산/기록)에 대한 단위 테스트.
import { formatWon, getActivityCost, getBudgetSummary, getDayTotal, getTripTotal, setActivityCost } from './activityCost'
import type { DayPlan, TripItinerary } from './tripPlan'

describe('formatWon', () => {
  it('formats an amount with thousands separators', () => {
    expect(formatWon(87000)).toBe('87,000원')
  })

  it('formats zero', () => {
    expect(formatWon(0)).toBe('0원')
  })
})

describe('getActivityCost', () => {
  it('returns the user-entered cost for an activity', () => {
    expect(getActivityCost('아사쿠사 관광', { '아사쿠사 관광': 5000 })).toBe(5000)
  })

  it('defaults to 0 when nothing has been entered', () => {
    expect(getActivityCost('아사쿠사 관광', {})).toBe(0)
  })
})

describe('getDayTotal', () => {
  const day: DayPlan = {
    day: 1,
    title: '1일차',
    activities: ['도쿄 디즈니랜드 (우라야스)', '센소지 (아사쿠사)', '이치란 라멘 신주쿠점'],
  }

  it('sums the entered costs for every activity in the day', () => {
    const dayCosts = {
      '도쿄 디즈니랜드 (우라야스)': 120000,
      '센소지 (아사쿠사)': 3000,
      '이치란 라멘 신주쿠점': 12000,
    }
    expect(getDayTotal(day, dayCosts)).toBe(120000 + 3000 + 12000)
  })

  it('treats missing entries as 0', () => {
    expect(getDayTotal(day, {})).toBe(0)
  })
})

describe('getTripTotal / getBudgetSummary', () => {
  const itinerary: TripItinerary = {
    destination: '일본 도쿄',
    duration: '2박 3일',
    travelers: 2,
    budget: 100,
    days: [
      { day: 1, title: '1일차', activities: ['도쿄 디즈니랜드 (우라야스)'] },
      { day: 2, title: '2일차', activities: ['센소지 (아사쿠사)'] },
      { day: 3, title: '3일차', activities: ['이치란 라멘 신주쿠점'] },
    ],
  }

  it('sums every day into a trip total', () => {
    const costs = {
      1: { '도쿄 디즈니랜드 (우라야스)': 120000 },
      2: { '센소지 (아사쿠사)': 3000 },
      3: { '이치란 라멘 신주쿠점': 15000 },
    }
    expect(getTripTotal(itinerary, costs)).toBe(120000 + 3000 + 15000)
  })

  it('reports how much of the budget is left when spending is within budget', () => {
    const costs = { 1: { '도쿄 디즈니랜드 (우라야스)': 120000 } }
    const summary = getBudgetSummary(itinerary, costs)
    expect(summary.budgetWon).toBe(1000000)
    expect(summary.spentWon).toBe(120000)
    expect(summary.remainingWon).toBe(1000000 - 120000)
    expect(summary.isOverBudget).toBe(false)
  })

  it('flags when spending exceeds the budget', () => {
    const costs = { 1: { '도쿄 디즈니랜드 (우라야스)': 1200000 } }
    const summary = getBudgetSummary(itinerary, costs)
    expect(summary.spentWon).toBe(1200000)
    expect(summary.remainingWon).toBe(1000000 - 1200000)
    expect(summary.isOverBudget).toBe(true)
  })
})

describe('setActivityCost', () => {
  it('records a cost for an activity on a given day, leaving other days untouched', () => {
    const next = setActivityCost({}, 1, '센소지 (아사쿠사)', 3000)
    expect(next).toEqual({ 1: { '센소지 (아사쿠사)': 3000 } })
  })

  it('overwrites an existing entry for the same activity', () => {
    const initial = { 1: { '센소지 (아사쿠사)': 3000 } }
    const next = setActivityCost(initial, 1, '센소지 (아사쿠사)', 5000)
    expect(next).toEqual({ 1: { '센소지 (아사쿠사)': 5000 } })
  })

  it('removes the entry when the amount is 0', () => {
    const initial = { 1: { '센소지 (아사쿠사)': 3000, '이치란 라멘 신주쿠점': 12000 } }
    const next = setActivityCost(initial, 1, '센소지 (아사쿠사)', 0)
    expect(next).toEqual({ 1: { '이치란 라멘 신주쿠점': 12000 } })
  })

  it('does not mutate the input', () => {
    const initial = { 1: { '센소지 (아사쿠사)': 3000 } }
    setActivityCost(initial, 1, '센소지 (아사쿠사)', 5000)
    expect(initial).toEqual({ 1: { '센소지 (아사쿠사)': 3000 } })
  })
})
