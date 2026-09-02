// generatePlan이 만든 한 일정 안에서 같은 장소·활동이 여러 날에 중복 추천되지 않는지를
// 모든 카탈로그 목적지 · 모든 기간 · 스타일 조합, 그리고 삭제/추가/날씨조정 편집 후에도
// 유지되는지 검증한다.
import {
  addActivity,
  addDay,
  applyWeatherAdjustment,
  createActivityHistory,
  generatePlan,
  getSwapOptions,
  removeActivity,
} from './generatePlan'
import { getSupportedDestinations } from './destinationCatalog'
import { DURATION_OPTIONS, STYLE_OPTIONS, emptyTripPlanFormValues, type TravelStyle } from './tripPlan'

const styleCombos: TravelStyle[][] = [
  ...STYLE_OPTIONS.map((s) => [s]),
  ['관광 중심', '맛집 중심'],
  ['관광 중심', '맛집 중심', '쇼핑 중심'],
  [...STYLE_OPTIONS],
]

const noDuplicates = (activities: string[]) => new Set(activities).size === activities.length

describe('generatePlan never repeats a spot across days', () => {
  for (const destination of getSupportedDestinations()) {
    it(`produces a duplicate-free itinerary for ${destination} at every duration and style combo`, () => {
      for (const duration of DURATION_OPTIONS) {
        for (const styles of styleCombos) {
          const plan = generatePlan({
            ...emptyTripPlanFormValues,
            destination,
            duration,
            styles: [...styles],
          })
          const all = plan.days.flatMap((d) => d.activities)
          expect(noDuplicates(all)).toBe(true)
        }
      }
    })
  }
})

describe('editing an itinerary never introduces a cross-day duplicate', () => {
  const cases: { destination: string; styles: TravelStyle[] }[] = [
    { destination: '제주', styles: ['관광 중심'] },
    { destination: '제주', styles: ['관광 중심', '맛집 중심'] },
    { destination: '일본 도쿄', styles: ['가족 여행', '커플 여행'] },
    { destination: '평행우주 도시', styles: ['관광 중심'] }, // 카탈로그 없는 목적지
  ]

  for (const { destination, styles } of cases) {
    it(`${destination} [${styles.join(', ')}] stays duplicate-free through remove/add/weather/addDay`, () => {
      const values = { ...emptyTripPlanFormValues, destination, duration: '3박 4일' as const, styles }
      let itinerary = generatePlan(values)
      let history = createActivityHistory(itinerary)

      // 각 날에서 첫 활동을 지우고(자동 백필), 활동을 하나 더 추가하고, 날씨 조정을 건다.
      for (const day of [1, 2, 3, 4]) {
        const first = itinerary.days.find((d) => d.day === day)!.activities[0]
        ;({ itinerary, history } = removeActivity(itinerary, values, day, first, history))
        expect(noDuplicates(itinerary.days.flatMap((d) => d.activities))).toBe(true)

        const added = addActivity(itinerary, values, day, history)
        itinerary = added.itinerary
        history = added.history
        expect(noDuplicates(itinerary.days.flatMap((d) => d.activities))).toBe(true)

        const weather = applyWeatherAdjustment(itinerary, day, history)
        itinerary = weather.itinerary
        history = weather.history
        expect(noDuplicates(itinerary.days.flatMap((d) => d.activities))).toBe(true)
      }

      const grown = addDay(itinerary, values, history)
      expect(noDuplicates(grown.itinerary.days.flatMap((d) => d.activities))).toBe(true)
    })
  }
})

describe('swap options never suggest a place already in the itinerary', () => {
  it('excludes every activity currently placed on any day', () => {
    const plan = generatePlan({
      ...emptyTripPlanFormValues,
      destination: '제주',
      duration: '3박 4일',
      styles: ['관광 중심', '맛집 중심'],
    })
    const placed = plan.days.flatMap((d) => d.activities)
    for (const day of plan.days) {
      for (const activity of day.activities) {
        const options = getSwapOptions('제주', activity, placed)
        for (const option of options) {
          expect(placed).not.toContain(option)
        }
      }
    }
  })
})
