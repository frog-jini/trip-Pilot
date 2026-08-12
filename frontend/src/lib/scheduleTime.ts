// 활동 배열의 "순서"만 갖고 하루 시간표를 시뮬레이션하는 모듈. 실제 이동거리·영업시간 계산은
// 하지 않는(PLAN-04 참고) 단순 근사치이며, ItineraryResult.tsx가 화면에 시간을 보여줄 때 쓴다.
import { findStyleForActivity } from './generatePlan'

// 화면에 보여줄 라벨 문구가 아니라 i18n 번역 키의 마지막 조각('common.mealLunch'/'common.mealDinner')이다 —
// 실제 문구로 바꾸는 건 이 값을 쓰는 컴포넌트(ItineraryResult)가 useLanguage().t()로 담당한다.
export type MealLabel = 'lunch' | 'dinner' | null

export interface ScheduledActivity {
  time: string
  activity: string
  mealLabel: MealLabel
}

// 하루의 기본 시간대. 활동이 이 개수(7개)를 넘어가면 아래에서 90분 간격으로 계속 이어 붙인다.
const TIME_SLOTS = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '20:30']
const SLOT_INTERVAL_MINUTES = 90
const MINUTES_PER_DAY = 24 * 60

// TIME_SLOTS 범위를 벗어난 인덱스(활동을 계속 추가해서 7개보다 많아진 경우)는 마지막 슬롯에서
// 90분씩 더해가며 계산한다 — 그래야 활동을 몇 개를 추가하든 항상 유일한 시간이 나온다.
function totalMinutesForIndex(index: number): number {
  if (index < TIME_SLOTS.length) {
    const [hour, minute] = TIME_SLOTS[index].split(':').map(Number)
    return hour * 60 + minute
  }

  const [lastHour, lastMinute] = TIME_SLOTS[TIME_SLOTS.length - 1].split(':').map(Number)
  const extraSlots = index - TIME_SLOTS.length + 1
  return lastHour * 60 + lastMinute + extraSlots * SLOT_INTERVAL_MINUTES
}

function timeForIndex(index: number): string {
  const totalMinutes = totalMinutesForIndex(index)
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** Whether the activity at this index would still land before the next midnight (i.e. the same day). */
export function isBeforeNextMidnight(index: number): boolean {
  return totalMinutesForIndex(index) < MINUTES_PER_DAY
}

// "맛집 중심" 스타일의 활동만 식사 라벨을 붙인다 — 관광지에 "점심"이라고 붙이면 어색하기 때문.
function mealLabelForTime(time: string): MealLabel {
  const hour = Number(time.split(':')[0])
  if (hour >= 11 && hour <= 13) return 'lunch'
  if (hour >= 17 && hour <= 20) return 'dinner'
  return null
}

/**
 * Attaches a time-of-day to each activity for display. 자동 계산된 시간이 기본값이지만,
 * overrides에 해당 활동명이 있으면 사용자가 직접 입력한 시간을 우선 사용한다(activityTime.ts 참고).
 * 활동 배열 자체는 건드리지 않는다.
 */
export function scheduleDay(
  activities: string[],
  destination: string,
  overrides: Record<string, string> = {},
): ScheduledActivity[] {
  return activities.map((activity, index) => {
    const time = overrides[activity] || timeForIndex(index)
    const style = findStyleForActivity(activity, destination)
    const mealLabel = style === '맛집 중심' ? mealLabelForTime(time) : null

    return { time, activity, mealLabel }
  })
}
