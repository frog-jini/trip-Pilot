// 일정 생성 폼(목적지/인원/예산/스타일 등) 필수값 검증 규칙을 확인한다.
import { emptyTripPlanFormValues, type TravelStyle } from './tripPlan'
import { validateTripPlanForm } from './tripPlanValidation'

const validValues = {
  ...emptyTripPlanFormValues,
  destination: '일본 도쿄',
  travelers: '2',
  budget: '100',
  styles: ['쇼핑 중심', '맛집 중심'] as TravelStyle[],
  startDate: '2026-07-25',
}

describe('validateTripPlanForm', () => {
  it('returns no errors for a fully valid form', () => {
    expect(validateTripPlanForm(validValues)).toEqual({})
  })

  it('requires a destination', () => {
    const errors = validateTripPlanForm({ ...validValues, destination: '  ' })
    expect(errors.destination).toBe('plan.errorDestinationRequired')
  })

  it('requires at least 1 traveler', () => {
    const errors = validateTripPlanForm({ ...validValues, travelers: '0' })
    expect(errors.travelers).toBe('plan.errorTravelersMin')
  })

  it('requires travelers to be entered', () => {
    const errors = validateTripPlanForm({ ...validValues, travelers: '' })
    expect(errors.travelers).toBe('plan.errorTravelersRequired')
  })

  it('requires a positive budget', () => {
    const errors = validateTripPlanForm({ ...validValues, budget: '0' })
    expect(errors.budget).toBe('plan.errorBudgetMin')
  })

  it('requires a budget to be entered', () => {
    const errors = validateTripPlanForm({ ...validValues, budget: '' })
    expect(errors.budget).toBe('plan.errorBudgetRequired')
  })

  it('requires at least one travel style', () => {
    const errors = validateTripPlanForm({ ...validValues, styles: [] })
    expect(errors.styles).toBe('plan.errorStylesRequired')
  })

  it('requires a start date', () => {
    const errors = validateTripPlanForm({ ...validValues, startDate: '' })
    expect(errors.startDate).toBe('plan.errorStartDateRequired')
  })
})
