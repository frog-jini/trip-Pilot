// 커뮤니티(다른 사람이 공유한 일정) API 클라이언트. 목록/상세 조회는 비로그인도 가능하고(token이
// null이어도 동작), 좋아요·공유·삭제는 로그인이 필요하다 — 실제 인증 여부 판단은 백엔드가 한다.
import type { TripItinerary } from './tripPlan'
import { apiRequest, ApiError } from './apiClient'

export interface CommunityTrip {
  id: string
  author: string
  tag: string
  likes: number
  views: number
  liked: boolean
  itinerary: TripItinerary
}

interface ApiCommunityTrip {
  id: string
  author: string
  tag: string
  likes: number
  views: number
  liked?: boolean
  itinerary: TripItinerary
}

// 서버 응답(liked가 비로그인 시 아예 안 올 수도 있음)을 프론트에서 쓰기 편한 형태로 정규화한다.
function fromApiTrip(trip: ApiCommunityTrip): CommunityTrip {
  return {
    id: trip.id,
    author: trip.author,
    tag: trip.tag,
    likes: trip.likes,
    views: trip.views,
    liked: trip.liked ?? false,
    itinerary: trip.itinerary,
  }
}

export async function getCommunityTrips(token: string | null, fetchImpl?: typeof fetch): Promise<CommunityTrip[]> {
  const { trips } = await apiRequest<{ trips: ApiCommunityTrip[] }>('/api/community', { token, fetchImpl })
  return trips.map(fromApiTrip)
}

export async function getCommunityTrip(
  id: string,
  token: string | null,
  fetchImpl?: typeof fetch,
): Promise<CommunityTrip | null> {
  try {
    const { trip } = await apiRequest<{ trip: ApiCommunityTrip }>(`/api/community/${id}`, { token, fetchImpl })
    return fromApiTrip(trip)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function toggleCommunityLike(
  token: string | null,
  id: string,
  fetchImpl?: typeof fetch,
): Promise<CommunityTrip> {
  const { trip } = await apiRequest<{ trip: ApiCommunityTrip }>(`/api/community/${id}/like`, {
    method: 'POST',
    token,
    fetchImpl,
  })
  return fromApiTrip(trip)
}

export async function recordCommunityView(id: string, fetchImpl?: typeof fetch): Promise<number> {
  const { views } = await apiRequest<{ views: number }>(`/api/community/${id}/view`, {
    method: 'POST',
    fetchImpl,
  })
  return views
}

// 토큰 없이 호출 자체를 막는 이유: 서버도 어차피 401을 낼 테지만, "이 일정을 내가 이미
// 공유했는지" 질문 자체가 로그인 여부와 무관하게 항상 null이 맞는 상황(비로그인 방문자)이라
// 불필요한 요청을 보내지 않는다.
export async function getMyPublishedTrip(
  token: string | null,
  sourceTripId: string,
  fetchImpl?: typeof fetch,
): Promise<CommunityTrip | null> {
  if (!token) return null
  const { trip } = await apiRequest<{ trip: ApiCommunityTrip | null }>(`/api/community/mine/${sourceTripId}`, {
    token,
    fetchImpl,
  })
  return trip ? fromApiTrip(trip) : null
}

export async function publishTrip(
  token: string | null,
  sourceTripId: string,
  tag: string,
  fetchImpl?: typeof fetch,
): Promise<CommunityTrip> {
  const { trip } = await apiRequest<{ trip: ApiCommunityTrip }>('/api/community', {
    method: 'POST',
    body: { tripId: sourceTripId, tag },
    token,
    fetchImpl,
  })
  return fromApiTrip(trip)
}

export async function updateCommunityTrip(
  token: string | null,
  communityTripId: string,
  tag: string,
  fetchImpl?: typeof fetch,
): Promise<CommunityTrip> {
  const { trip } = await apiRequest<{ trip: ApiCommunityTrip }>(`/api/community/${communityTripId}`, {
    method: 'PUT',
    body: { tag },
    token,
    fetchImpl,
  })
  return fromApiTrip(trip)
}

export async function unpublishTrip(
  token: string | null,
  communityTripId: string,
  fetchImpl?: typeof fetch,
): Promise<void> {
  await apiRequest(`/api/community/${communityTripId}`, { method: 'DELETE', token, fetchImpl })
}
