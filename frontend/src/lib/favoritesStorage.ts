// 즐겨찾기(★) 장소를 백엔드 /api/favorites와 주고받는 함수 모음 + 즐겨찾기를 일정 생성 폼에
// 자동으로 반영하는 로직. 여행지 검색, 일정 상세, 커뮤니티 상세 등 여러 화면에서 재사용된다.
import { apiRequest } from './apiClient'

export interface FavoritePlace {
  id: string
  destination: string
  activity: string
}

export async function readFavorites(token: string | null, fetchImpl?: typeof fetch): Promise<FavoritePlace[]> {
  if (!token) return []
  const { favorites } = await apiRequest<{ favorites: FavoritePlace[] }>('/api/favorites', { token, fetchImpl })
  return favorites
}

export async function addFavorite(
  token: string | null,
  place: { destination: string; activity: string },
  fetchImpl?: typeof fetch,
): Promise<FavoritePlace> {
  const { favorite } = await apiRequest<{ favorite: FavoritePlace }>('/api/favorites', {
    method: 'POST',
    body: place,
    token,
    fetchImpl,
  })
  return favorite
}

export async function removeFavorite(token: string | null, id: string, fetchImpl?: typeof fetch): Promise<void> {
  await apiRequest(`/api/favorites/${id}`, { method: 'DELETE', token, fetchImpl })
}

/** id가 아니라 (목적지, 활동명) 조합으로 판단한다 — 화면에는 늘 이 둘만 보이고 id는 몰라도 되기 때문. */
export function isFavorited(favorites: FavoritePlace[], place: { destination: string; activity: string }): boolean {
  return favorites.some((f) => f.destination === place.destination && f.activity === place.activity)
}

/** Prepends the destination's favorited places to mustVisit text, deduplicated. Pure — the
 * caller is responsible for fetching the current favorites list. */
export function mergeFavoritesIntoMustVisit(mustVisit: string, destination: string, favorites: FavoritePlace[]): string {
  const existing = mustVisit
    .split(/[,\n]/)
    .map((place) => place.trim())
    .filter(Boolean)

  const favoritedActivities = favorites
    .filter((favorite) => favorite.destination === destination)
    .map((favorite) => favorite.activity)

  const rest = existing.filter((place) => !favoritedActivities.includes(place))

  return [...favoritedActivities, ...rest].join(', ')
}
