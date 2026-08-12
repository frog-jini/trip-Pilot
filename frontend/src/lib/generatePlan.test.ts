// generatePlan.ts의 결정론적 일정 생성 규칙 엔진과, 활동 추가/삭제/교체/일자 추가/날씨 재조정
// 등 일정 편집 함수들을 검증한다.
import { emptyTripPlanFormValues, type TripPlanFormValues } from './tripPlan'
import {
  addActivity,
  addNamedActivity,
  addDay,
  applyWeatherAdjustment,
  createActivityHistory,
  generatePlan,
  getSwapOptions,
  removeActivity,
  selectActivity,
} from './generatePlan'

describe('generatePlan', () => {
  it('creates one day per night+1 implied by the selected duration', () => {
    const plan = generatePlan({ ...emptyTripPlanFormValues, duration: '2박 3일', styles: ['맛집 중심'] })
    expect(plan.days).toHaveLength(3)
  })

  it('titles each day in order', () => {
    const plan = generatePlan({ ...emptyTripPlanFormValues, duration: '3박 4일', styles: ['맛집 중심'] })
    expect(plan.days.map((d) => d.title)).toEqual(['1일차', '2일차', '3일차', '4일차'])
  })

  it('carries over the destination, traveler count, and budget', () => {
    const plan = generatePlan({
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      travelers: '2',
      budget: '100',
      styles: ['맛집 중심'],
    })
    expect(plan.destination).toBe('일본 도쿄')
    expect(plan.travelers).toBe(2)
    expect(plan.budget).toBe(100)
  })

  it('includes an activity from every selected style each day', () => {
    const plan = generatePlan({
      ...emptyTripPlanFormValues,
      duration: '1박 2일',
      styles: ['쇼핑 중심', '힐링 여행'],
    })

    for (const day of plan.days) {
      expect(day.activities.some((activity) => activity.includes('쇼핑'))).toBe(true)
    }
  })

  it('varies the activities across different days for the same style', () => {
    const plan = generatePlan({ ...emptyTripPlanFormValues, duration: '3박 4일', styles: ['쇼핑 중심'] })
    const uniqueFirstActivities = new Set(plan.days.map((d) => d.activities[0]))
    expect(uniqueFirstActivities.size).toBeGreaterThan(1)
  })

  it('prepends must-visit places to day 1 only', () => {
    const plan = generatePlan({
      ...emptyTripPlanFormValues,
      duration: '2박 3일',
      styles: ['맛집 중심'],
      mustVisit: '츠키지 시장, 도쿄타워\n긴자',
    })

    expect(plan.days[0].activities.slice(0, 3)).toEqual(['츠키지 시장', '도쿄타워', '긴자'])
    expect(plan.days[1].activities).not.toContain('츠키지 시장')
  })

  it('recommends several spots per day even when only one style is selected', () => {
    const plan = generatePlan({ ...emptyTripPlanFormValues, duration: '1박 2일', styles: ['맛집 중심'] })

    for (const day of plan.days) {
      expect(day.activities.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('recommends more spots per day as more styles are selected', () => {
    const plan = generatePlan({
      ...emptyTripPlanFormValues,
      duration: '1박 2일',
      styles: ['맛집 중심', '쇼핑 중심'],
    })

    expect(plan.days[0].activities.length).toBeGreaterThan(3)
  })
})

describe('generatePlan with a start date', () => {
  it('attaches the start date to day 1 and increments it for each following day', () => {
    const plan = generatePlan({
      ...emptyTripPlanFormValues,
      duration: '2박 3일',
      styles: ['맛집 중심'],
      startDate: '2026-07-25',
    })

    expect(plan.days.map((d) => d.date)).toEqual(['2026-07-25', '2026-07-26', '2026-07-27'])
  })

  it('leaves the date undefined when no start date is provided', () => {
    const plan = generatePlan({ ...emptyTripPlanFormValues, duration: '1박 2일', styles: ['맛집 중심'] })
    expect(plan.days.every((d) => d.date === undefined)).toBe(true)
  })
})

describe('addDay', () => {
  const values: TripPlanFormValues = { ...emptyTripPlanFormValues, duration: '2박 3일', styles: ['맛집 중심'] }
  const plan = generatePlan(values)
  const history = createActivityHistory(plan)

  it('appends one more day after the last existing day, beyond what the selected duration created', () => {
    const { itinerary } = addDay(plan, values, history)
    expect(itinerary.days).toHaveLength(plan.days.length + 1)
  })

  it('numbers and titles the new day sequentially', () => {
    const { itinerary } = addDay(plan, values, history)
    const newDay = itinerary.days[itinerary.days.length - 1]
    expect(newDay.day).toBe(4)
    expect(newDay.title).toBe('4일차')
  })

  it('fills the new day with activities from the selected styles', () => {
    const { itinerary } = addDay(plan, values, history)
    const newDay = itinerary.days[itinerary.days.length - 1]
    expect(newDay.activities.length).toBeGreaterThan(0)
  })

  it('does not modify any existing day', () => {
    const { itinerary } = addDay(plan, values, history)
    expect(itinerary.days.slice(0, plan.days.length)).toEqual(plan.days)
  })

  it('records the new day activities in the returned history', () => {
    const { itinerary, history: nextHistory } = addDay(plan, values, history)
    const newDay = itinerary.days[itinerary.days.length - 1]
    expect(nextHistory[newDay.day]).toEqual(newDay.activities)
  })

  it('can be called repeatedly to keep adding days past the original 3', () => {
    const first = addDay(plan, values, history)
    const second = addDay(first.itinerary, values, first.history)
    expect(second.itinerary.days).toHaveLength(5)
    expect(second.itinerary.days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5])
  })

  it('assigns the new day the next calendar date after the last day, when a start date is set', () => {
    const datedValues: TripPlanFormValues = { ...values, startDate: '2026-07-25' }
    const datedPlan = generatePlan(datedValues)
    const datedHistory = createActivityHistory(datedPlan)

    const { itinerary } = addDay(datedPlan, datedValues, datedHistory)
    const newDay = itinerary.days[itinerary.days.length - 1]

    expect(newDay.date).toBe('2026-07-28')
  })

  it('leaves the new day date undefined when there is no start date', () => {
    const { itinerary } = addDay(plan, values, history)
    const newDay = itinerary.days[itinerary.days.length - 1]
    expect(newDay.date).toBeUndefined()
  })
})

describe('removeActivity', () => {
  const values: TripPlanFormValues = { ...emptyTripPlanFormValues, duration: '2박 3일', styles: ['맛집 중심'] }
  const plan = generatePlan(values)
  const history = createActivityHistory(plan)
  const activityToRemove = plan.days[0].activities[0]

  it('removes the specified activity from the given day', () => {
    const { itinerary } = removeActivity(plan, values, 1, activityToRemove, history)
    expect(itinerary.days[0].activities).not.toContain(activityToRemove)
  })

  it('backfills the day with a fresh, previously unused suggestion from the same styles', () => {
    const { itinerary, addedActivity } = removeActivity(plan, values, 1, activityToRemove, history)

    expect(addedActivity).not.toBeNull()
    expect(addedActivity).not.toBe(activityToRemove)
    expect(itinerary.days[0].activities).toContain(addedActivity)
    expect(itinerary.days[0].activities).toHaveLength(plan.days[0].activities.length)
  })

  it('does not modify other days', () => {
    const { itinerary } = removeActivity(plan, values, 1, activityToRemove, history)
    expect(itinerary.days[1]).toEqual(plan.days[1])
  })

  it('does not add a duplicate of an activity already present that day', () => {
    const { itinerary } = removeActivity(plan, values, 1, activityToRemove, history)
    const activities = itinerary.days[0].activities
    expect(new Set(activities).size).toBe(activities.length)
  })

  it('shrinks the day instead of duplicating when no replacement is available', () => {
    const noStyleValues: TripPlanFormValues = {
      ...emptyTripPlanFormValues,
      duration: '2박 3일',
      mustVisit: '도쿄타워',
      styles: [],
    }
    const noStylePlan = generatePlan(noStyleValues)
    const noStyleHistory = createActivityHistory(noStylePlan)

    const { itinerary, addedActivity } = removeActivity(
      noStylePlan,
      noStyleValues,
      1,
      '도쿄타워',
      noStyleHistory,
    )

    expect(addedActivity).toBeNull()
    expect(itinerary.days[0].activities).not.toContain('도쿄타워')
    expect(itinerary.days[0].activities).toHaveLength(noStylePlan.days[0].activities.length - 1)
  })

  it('never brings back an activity that was already removed from that day, even after later removals', () => {
    const first = removeActivity(plan, values, 1, activityToRemove, history)
    const secondTarget = first.itinerary.days[0].activities[0]

    const second = removeActivity(first.itinerary, values, 1, secondTarget, first.history)

    expect(second.itinerary.days[0].activities).not.toContain(activityToRemove)
    expect(second.addedActivity).not.toBe(activityToRemove)
  })
})

describe('addActivity', () => {
  const values: TripPlanFormValues = { ...emptyTripPlanFormValues, duration: '2박 3일', styles: ['맛집 중심'] }
  const plan = generatePlan(values)
  const history = createActivityHistory(plan)

  it('adds one more activity to the specified day without removing any existing ones', () => {
    const { itinerary } = addActivity(plan, values, 1, history)

    expect(itinerary.days[0].activities).toHaveLength(plan.days[0].activities.length + 1)
    for (const activity of plan.days[0].activities) {
      expect(itinerary.days[0].activities).toContain(activity)
    }
  })

  it('returns the added activity', () => {
    const { itinerary, addedActivity } = addActivity(plan, values, 1, history)

    expect(addedActivity).not.toBeNull()
    expect(itinerary.days[0].activities).toContain(addedActivity)
  })

  it('does not modify other days', () => {
    const { itinerary } = addActivity(plan, values, 1, history)
    expect(itinerary.days[1]).toEqual(plan.days[1])
  })

  it('does not add a duplicate of an activity already present that day', () => {
    const { itinerary } = addActivity(plan, values, 1, history)
    const activities = itinerary.days[0].activities
    expect(new Set(activities).size).toBe(activities.length)
  })

  it('records the added activity in the returned history so it is never suggested again for that day', () => {
    const first = addActivity(plan, values, 1, history)
    const second = addActivity(first.itinerary, values, 1, first.history)

    expect(second.addedActivity).not.toBe(first.addedActivity)
  })

  it('returns null and leaves the day unchanged when no style is selected at all', () => {
    const noStyleValues: TripPlanFormValues = {
      ...emptyTripPlanFormValues,
      duration: '2박 3일',
      mustVisit: '도쿄타워',
      styles: [],
    }
    const noStylePlan = generatePlan(noStyleValues)
    const noStyleHistory = createActivityHistory(noStylePlan)

    const { itinerary, addedActivity, reachedDailyLimit } = addActivity(
      noStylePlan,
      noStyleValues,
      1,
      noStyleHistory,
    )

    expect(addedActivity).toBeNull()
    expect(reachedDailyLimit).toBe(false)
    expect(itinerary.days[0].activities).toEqual(noStylePlan.days[0].activities)
  })

  it('keeps adding activities past the size of the unique style pool by cycling back through it', () => {
    // The '맛집 중심' pool has exactly 6 unique entries; day 1 already starts with 3.
    let current = { itinerary: plan, history }

    for (let i = 0; i < 5; i++) {
      const result = addActivity(current.itinerary, values, 1, current.history)
      expect(result.addedActivity).not.toBeNull()
      current = { itinerary: result.itinerary, history: result.history }
    }

    // 3 initial + 5 added = 8 activities, well past the 6-item unique pool.
    expect(current.itinerary.days[0].activities).toHaveLength(8)
  })

  it('stops and reports reachedDailyLimit once the next activity would land past midnight', () => {
    let current = { itinerary: plan, history }

    // Add until the day is as full as it can get (3 initial + 6 more = 9, the last slot before midnight).
    for (let i = 0; i < 6; i++) {
      const result = addActivity(current.itinerary, values, 1, current.history)
      current = { itinerary: result.itinerary, history: result.history }
    }
    expect(current.itinerary.days[0].activities).toHaveLength(9)

    const blocked = addActivity(current.itinerary, values, 1, current.history)

    expect(blocked.addedActivity).toBeNull()
    expect(blocked.reachedDailyLimit).toBe(true)
    expect(blocked.itinerary.days[0].activities).toEqual(current.itinerary.days[0].activities)
  })
})

describe('addNamedActivity', () => {
  const values: TripPlanFormValues = { ...emptyTripPlanFormValues, duration: '2박 3일', styles: ['맛집 중심'] }
  const plan = generatePlan(values)
  const history = createActivityHistory(plan)

  it('appends the given activity text to the specified day, keeping existing ones', () => {
    const { itinerary } = addNamedActivity(plan, 1, '디즈니랜드', history)

    expect(itinerary.days[0].activities).toHaveLength(plan.days[0].activities.length + 1)
    expect(itinerary.days[0].activities).toContain('디즈니랜드')
    for (const activity of plan.days[0].activities) {
      expect(itinerary.days[0].activities).toContain(activity)
    }
  })

  it('does not modify other days', () => {
    const { itinerary } = addNamedActivity(plan, 1, '디즈니랜드', history)
    expect(itinerary.days[1]).toEqual(plan.days[1])
  })

  it('records the added activity in the returned history', () => {
    const { history: nextHistory } = addNamedActivity(plan, 1, '디즈니랜드', history)
    expect(nextHistory[1]).toContain('디즈니랜드')
  })

  it('does not duplicate the activity in history if it was already shown that day', () => {
    const alreadyShown = plan.days[0].activities[0]
    const { history: nextHistory } = addNamedActivity(plan, 1, alreadyShown, history)
    const occurrences = nextHistory[1].filter((a) => a === alreadyShown).length
    expect(occurrences).toBe(1)
  })

  it('stops and reports reachedDailyLimit once the day is already full', () => {
    let current = { itinerary: plan, history }
    for (let i = 0; i < 6; i++) {
      current = addNamedActivity(current.itinerary, 1, `추가 활동 ${i}`, current.history)
    }
    expect(current.itinerary.days[0].activities).toHaveLength(9)

    const blocked = addNamedActivity(current.itinerary, 1, '한 번 더', current.history)

    expect(blocked.reachedDailyLimit).toBe(true)
    expect(blocked.itinerary.days[0].activities).toEqual(current.itinerary.days[0].activities)
  })
})

describe('applyWeatherAdjustment', () => {
  const values: TripPlanFormValues = {
    ...emptyTripPlanFormValues,
    duration: '2박 3일',
    styles: ['관광 중심'],
  }
  const plan = generatePlan(values)
  const history = createActivityHistory(plan)

  it('replaces outdoor-style activities on the target day with indoor alternatives', () => {
    const result = applyWeatherAdjustment(plan, 1, history)

    expect(result.changed).toBe(true)
    for (const activity of result.itinerary.days[0].activities) {
      expect(plan.days[0].activities).not.toContain(activity)
    }
  })

  it('does not modify other days', () => {
    const result = applyWeatherAdjustment(plan, 1, history)
    expect(result.itinerary.days[1]).toEqual(plan.days[1])
  })

  it('leaves already-indoor activities unchanged', () => {
    const indoorValues: TripPlanFormValues = {
      ...emptyTripPlanFormValues,
      duration: '2박 3일',
      styles: ['맛집 중심'],
    }
    const indoorPlan = generatePlan(indoorValues)
    const indoorHistory = createActivityHistory(indoorPlan)

    const result = applyWeatherAdjustment(indoorPlan, 1, indoorHistory)

    expect(result.changed).toBe(false)
    expect(result.itinerary.days[0].activities).toEqual(indoorPlan.days[0].activities)
  })

  it('leaves must-visit places untouched', () => {
    const mustVisitValues: TripPlanFormValues = {
      ...emptyTripPlanFormValues,
      duration: '2박 3일',
      styles: ['관광 중심'],
      mustVisit: '도쿄타워',
    }
    const mustVisitPlan = generatePlan(mustVisitValues)
    const mustVisitHistory = createActivityHistory(mustVisitPlan)

    const result = applyWeatherAdjustment(mustVisitPlan, 1, mustVisitHistory)

    expect(result.itinerary.days[0].activities).toContain('도쿄타워')
  })

  it('does not resurrect an activity already removed from that day', () => {
    const removed = removeActivity(plan, values, 1, plan.days[0].activities[0], history)
    const result = applyWeatherAdjustment(removed.itinerary, 1, removed.history)

    expect(result.itinerary.days[0].activities).not.toContain(plan.days[0].activities[0])
  })

  it('returns the itinerary unchanged for a day that does not exist', () => {
    const result = applyWeatherAdjustment(plan, 99, history)
    expect(result.changed).toBe(false)
    expect(result.itinerary).toEqual(plan)
  })
})

describe('generatePlan with a catalog-supported destination', () => {
  it('uses concrete named places instead of generic phrases', () => {
    const plan = generatePlan({
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '1박 2일',
      styles: ['가족 여행'],
    })

    expect(plan.days[0].activities).toContain('도쿄 디즈니랜드 (우라야스)')
  })

  it('recommends different concrete places for different destinations with the same style', () => {
    const tokyoPlan = generatePlan({
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '1박 2일',
      styles: ['가족 여행'],
    })
    const osakaPlan = generatePlan({
      ...emptyTripPlanFormValues,
      destination: '오사카',
      duration: '1박 2일',
      styles: ['가족 여행'],
    })

    expect(tokyoPlan.days[0].activities).not.toEqual(osakaPlan.days[0].activities)
  })

  it('falls back to generic activities for a destination with no catalog entry', () => {
    const plan = generatePlan({
      ...emptyTripPlanFormValues,
      destination: '평행우주 도시',
      duration: '1박 2일',
      styles: ['가족 여행'],
    })

    expect(plan.days[0].activities).toContain('테마파크 가족 나들이')
  })
})

describe('getSwapOptions', () => {
  it('returns several concrete alternatives for a resolvable activity', () => {
    const plan = generatePlan({
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '1박 2일',
      styles: ['가족 여행'],
    })
    const history = createActivityHistory(plan)
    const current = plan.days[0].activities[0]

    const options = getSwapOptions('일본 도쿄', current, history[1])

    expect(options.length).toBeGreaterThan(0)
    expect(options).not.toContain(current)
  })

  it('returns an empty list for an activity that cannot be matched to any style (e.g. a must-visit place)', () => {
    const options = getSwapOptions('일본 도쿄', '사용자가 직접 입력한 장소', [])
    expect(options).toEqual([])
  })
})

describe('selectActivity', () => {
  it('replaces the chosen activity with the user-picked one and records it in history', () => {
    const plan = generatePlan({
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '1박 2일',
      styles: ['가족 여행'],
    })
    const history = createActivityHistory(plan)
    const oldActivity = plan.days[0].activities[0]
    const [chosen] = getSwapOptions('일본 도쿄', oldActivity, history[1])

    const result = selectActivity(plan, 1, oldActivity, chosen, history)

    expect(result.itinerary.days[0].activities).toContain(chosen)
    expect(result.itinerary.days[0].activities).not.toContain(oldActivity)
    expect(result.history[1]).toContain(chosen)
  })

  it('does not modify other days', () => {
    const plan = generatePlan({
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['가족 여행'],
    })
    const history = createActivityHistory(plan)
    const oldActivity = plan.days[0].activities[0]
    const [chosen] = getSwapOptions('일본 도쿄', oldActivity, history[1])

    const result = selectActivity(plan, 1, oldActivity, chosen, history)

    expect(result.itinerary.days[1]).toEqual(plan.days[1])
  })
})
