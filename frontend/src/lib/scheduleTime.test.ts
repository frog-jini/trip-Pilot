// 활동 배열에 시뮬레이션 시간을 붙이는 scheduleDay(자동 계산 + 사용자 지정 override 병행)와,
// 하루가 자정을 넘기지 않는지 판단하는 isBeforeNextMidnight을 검증한다.
import { isBeforeNextMidnight, scheduleDay } from './scheduleTime'

describe('scheduleDay', () => {
  const destination = '평행우주 도시' // no catalog entry, so generic style activities apply

  it('returns an empty schedule for no activities', () => {
    expect(scheduleDay([], destination)).toEqual([])
  })

  it('assigns increasing times starting at 09:00', () => {
    const result = scheduleDay(['현지 맛집 탐방', '대표 랜드마크 관광', '대형 쇼핑몰 쇼핑'], destination)
    expect(result.map((r) => r.time)).toEqual(['09:00', '11:00', '13:00'])
  })

  it('keeps the original activity text unchanged', () => {
    const result = scheduleDay(['대표 랜드마크 관광'], destination)
    expect(result[0].activity).toBe('대표 랜드마크 관광')
  })

  it('labels a 맛집 중심 activity landing in the lunch window as lunch', () => {
    const result = scheduleDay(['대표 랜드마크 관광', '현지 맛집 탐방'], destination)
    expect(result[1].time).toBe('11:00')
    expect(result[1].mealLabel).toBe('lunch')
  })

  it('labels a 맛집 중심 activity landing in the dinner window as dinner', () => {
    const result = scheduleDay(['x1', 'x2', 'x3', 'x4', '현지 맛집 탐방'], destination)
    expect(result[4].time).toBe('17:00')
    expect(result[4].mealLabel).toBe('dinner')
  })

  it('does not label a non-맛집 activity as a meal even if it falls in a meal-time slot', () => {
    const result = scheduleDay(['x1', '대표 랜드마크 관광'], destination)
    expect(result[1].time).toBe('11:00')
    expect(result[1].mealLabel).toBeNull()
  })

  it('does not label a 맛집 중심 activity outside meal hours', () => {
    const result = scheduleDay(['현지 맛집 탐방'], destination)
    expect(result[0].time).toBe('09:00')
    expect(result[0].mealLabel).toBeNull()
  })

  it('keeps producing strictly increasing times beyond the predefined slots', () => {
    const activities = Array.from({ length: 10 }, (_, i) => `activity-${i}`)
    const result = scheduleDay(activities, destination)
    const times = result.map((r) => r.time)
    expect(new Set(times).size).toBe(times.length)
  })

  it('uses a user-provided time override instead of the computed one', () => {
    const result = scheduleDay(
      ['대표 랜드마크 관광', '대형 쇼핑몰 쇼핑'],
      destination,
      { '대형 쇼핑몰 쇼핑': '16:45' },
    )
    expect(result[0].time).toBe('09:00')
    expect(result[1].time).toBe('16:45')
  })

  it('recomputes the meal label based on the overridden time', () => {
    const result = scheduleDay(['현지 맛집 탐방'], destination, { '현지 맛집 탐방': '18:00' })
    expect(result[0].time).toBe('18:00')
    expect(result[0].mealLabel).toBe('dinner')
  })

  it('ignores an override for an activity name that is not in the day', () => {
    const result = scheduleDay(['대표 랜드마크 관광'], destination, { '없는 활동': '10:00' })
    expect(result[0].time).toBe('09:00')
  })
})

describe('isBeforeNextMidnight', () => {
  it('is true for every one of the predefined daytime/evening slots', () => {
    for (let index = 0; index < 7; index++) {
      expect(isBeforeNextMidnight(index)).toBe(true)
    }
  })

  it('is still true while the 90-minute increments stay within the same day', () => {
    expect(isBeforeNextMidnight(7)).toBe(true) // 22:00
    expect(isBeforeNextMidnight(8)).toBe(true) // 23:30
  })

  it('is false once the next slot would roll into the next calendar day', () => {
    expect(isBeforeNextMidnight(9)).toBe(false) // would be 25:00 -> next day
    expect(isBeforeNextMidnight(20)).toBe(false)
  })
})
