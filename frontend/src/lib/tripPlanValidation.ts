// 일정 생성 폼(TripPlanForm) 검증 규칙. tripPlanChat.ts의 nextTripPlanQuestion()이 이 에러
// 객체를 재사용해서 "폼에서 막히는 지점 = 챗에서 되묻는 지점"이 항상 같게 유지된다.
import type { TripPlanFormValues } from './tripPlan'

export interface TripPlanFormErrors {
  destination?: string
  travelers?: string
  budget?: string
  styles?: string
  startDate?: string
}

export function validateTripPlanForm(values: TripPlanFormValues): TripPlanFormErrors {
  const errors: TripPlanFormErrors = {}

  if (!values.destination.trim()) {
    errors.destination = 'plan.errorDestinationRequired'
  }

  if (!values.travelers.trim()) {
    errors.travelers = 'plan.errorTravelersRequired'
  } else if (Number(values.travelers) < 1) {
    errors.travelers = 'plan.errorTravelersMin'
  }

  if (!values.budget.trim()) {
    errors.budget = 'plan.errorBudgetRequired'
  } else if (Number(values.budget) <= 0) {
    errors.budget = 'plan.errorBudgetMin'
  }

  if (values.styles.length === 0) {
    errors.styles = 'plan.errorStylesRequired'
  }

  if (!values.startDate.trim()) {
    errors.startDate = 'plan.errorStartDateRequired'
  }

  return errors
}
