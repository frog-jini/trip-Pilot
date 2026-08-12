// 저장된 일정(trips)을 백엔드 /api/trips와 주고받는 함수 모음. ApiTrip(서버가 쓰는 필드명:
// formValues 등) ↔ SavedTrip(프론트에서 쓰는 필드명: values 등) 사이의 변환을 fromApiTrip이 담당한다.
import type { ActivityHistory } from './generatePlan'
import type { TripItinerary, TripPlanFormValues } from './tripPlan'
import type { ActivityCosts } from './activityCost'
import type { ActivityTimes } from './activityTime'
import { apiRequest, ApiError } from './apiClient'

export interface SavedTrip {
  id: string
  itinerary: TripItinerary
  values: TripPlanFormValues
  history: ActivityHistory
  costs: ActivityCosts
  // 사용자가 활동별로 직접 지정한 시간. 지정하지 않은 활동은 scheduleTime.ts가 자동 계산한다.
  times: ActivityTimes
  createdAt: string
}

export type NewTrip = Omit<SavedTrip, 'id' | 'createdAt' | 'costs' | 'times'> & {
  costs?: ActivityCosts
  times?: ActivityTimes
}

interface ApiTrip {
  id: string
  itinerary: TripItinerary
  formValues: TripPlanFormValues
  history: ActivityHistory
  costs: ActivityCosts
  times: ActivityTimes
  createdAt: string
}

function fromApiTrip(trip: ApiTrip): SavedTrip {
  return {
    id: trip.id,
    itinerary: trip.itinerary,
    values: trip.formValues,
    history: trip.history,
    costs: trip.costs,
    times: trip.times,
    createdAt: trip.createdAt,
  }
}

export async function readTrips(token: string | null, fetchImpl?: typeof fetch): Promise<SavedTrip[]> {
  if (!token) return []
  const { trips } = await apiRequest<{ trips: ApiTrip[] }>('/api/trips', { token, fetchImpl })
  return trips.map(fromApiTrip)
}

export async function addTrip(
  token: string | null,
  trip: NewTrip,
  fetchImpl?: typeof fetch,
): Promise<SavedTrip> {
  const { trip: created } = await apiRequest<{ trip: ApiTrip }>('/api/trips', {
    method: 'POST',
    body: { itinerary: trip.itinerary, formValues: trip.values, history: trip.history },
    token,
    fetchImpl,
  })
  return fromApiTrip(created)
}

export async function getTrip(
  token: string | null,
  id: string,
  fetchImpl?: typeof fetch,
): Promise<SavedTrip | null> {
  if (!token) return null

  try {
    const { trip } = await apiRequest<{ trip: ApiTrip }>(`/api/trips/${id}`, { token, fetchImpl })
    return fromApiTrip(trip)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

// 주의: costs/times를 안 넘기면 서버가 빈 값('{}')으로 덮어쓴다(백엔드 PUT이 그렇게 동작함) —
// 그래서 itinerary만 바뀌는 호출부(TripDetailPage.persistTripUpdate)도 매번 현재 costs/times를
// 함께 실어 보내야 기존에 입력해둔 값이 사라지지 않는다.
export async function updateTrip(
  token: string | null,
  id: string,
  updates: {
    itinerary: TripItinerary
    history: ActivityHistory
    costs?: ActivityCosts
    times?: ActivityTimes
  },
  fetchImpl?: typeof fetch,
): Promise<SavedTrip | null> {
  try {
    const { trip } = await apiRequest<{ trip: ApiTrip }>(`/api/trips/${id}`, {
      method: 'PUT',
      body: {
        itinerary: updates.itinerary,
        history: updates.history,
        costs: updates.costs ?? {},
        times: updates.times ?? {},
      },
      token,
      fetchImpl,
    })
    return fromApiTrip(trip)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function deleteTrip(token: string | null, id: string, fetchImpl?: typeof fetch): Promise<void> {
  await apiRequest(`/api/trips/${id}`, { method: 'DELETE', token, fetchImpl })
}
