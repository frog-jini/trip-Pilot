// 활동별로 사용자가 실제 쓴 비용을 기록/집계하는 함수 모음. 일정 생성 시 잡은 예산(TripItinerary.budget,
// 만원 단위)과 여기 누적된 실사용 비용을 비교해서 "얼마 남았는지"를 보여주는 데 쓰인다.
import type { DayPlan, TripItinerary } from './tripPlan'

export type DayCosts = Record<string, number>
export type ActivityCosts = Record<number, DayCosts>

export function formatWon(amountWon: number): string {
  return `${Math.round(amountWon).toLocaleString('ko-KR')}원`
}

export function getActivityCost(activity: string, dayCosts: DayCosts = {}): number {
  return dayCosts[activity] ?? 0
}

export function getDayTotal(day: DayPlan, dayCosts: DayCosts = {}): number {
  return day.activities.reduce((sum, activity) => sum + getActivityCost(activity, dayCosts), 0)
}

export function getTripTotal(itinerary: TripItinerary, costs: ActivityCosts = {}): number {
  return itinerary.days.reduce((sum, day) => sum + getDayTotal(day, costs[day.day]), 0)
}

export interface BudgetSummary {
  budgetWon: number
  spentWon: number
  remainingWon: number
  isOverBudget: boolean
}

export function getBudgetSummary(itinerary: TripItinerary, costs: ActivityCosts = {}): BudgetSummary {
  // itinerary.budget은 "만원" 단위로 입력받으므로(TripPlanForm), 실제 원 단위 비교를 위해 10000을 곱한다.
  const budgetWon = itinerary.budget * 10000
  const spentWon = getTripTotal(itinerary, costs)

  return {
    budgetWon,
    spentWon,
    remainingWon: budgetWon - spentWon,
    isOverBudget: spentWon > budgetWon,
  }
}

export function setActivityCost(
  costs: ActivityCosts,
  day: number,
  activity: string,
  amountWon: number,
): ActivityCosts {
  const dayCosts = { ...(costs[day] ?? {}) }

  // 0원(또는 그 이하)을 입력하면 "비용 없음"이 아니라 아예 기록을 지운다 — 입력창을 비웠을 때
  // 총액 계산에서 자연스럽게 빠지도록 하기 위함.
  if (amountWon > 0) {
    dayCosts[activity] = amountWon
  } else {
    delete dayCosts[activity]
  }

  return { ...costs, [day]: dayCosts }
}
