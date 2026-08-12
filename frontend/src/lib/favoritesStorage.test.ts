// /api/favorites와의 CRUD 계약(fakeFetch로 검증)과, 즐겨찾기를 일정 생성 폼의 "필수 방문지"에
// 자동으로 합치는 mergeFavoritesIntoMustVisit의 문자열 병합 규칙을 함께 검증한다.
import {
  addFavorite,
  isFavorited,
  mergeFavoritesIntoMustVisit,
  readFavorites,
  removeFavorite,
  type FavoritePlace,
} from './favoritesStorage'

function fakeFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('readFavorites', () => {
  it('returns an empty list without calling the API when there is no token', async () => {
    const fetchImpl = vi.fn()
    expect(await readFavorites(null, fetchImpl)).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fetches and returns favorites for a logged-in user', async () => {
    const fetchImpl = fakeFetch(200, {
      favorites: [{ id: 'f1', destination: '일본 도쿄', activity: '아사쿠사 관광' }],
    })

    const favorites = await readFavorites('token123', fetchImpl)

    expect(favorites).toEqual([{ id: 'f1', destination: '일본 도쿄', activity: '아사쿠사 관광' }])
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('http://localhost:4000/api/favorites')
    expect(init.headers.Authorization).toBe('Bearer token123')
  })
})

describe('addFavorite', () => {
  it('posts the destination and activity, returning the created favorite', async () => {
    const fetchImpl = fakeFetch(201, {
      favorite: { id: 'f1', destination: '일본 도쿄', activity: '아사쿠사 관광' },
    })

    const favorite = await addFavorite(
      'token123',
      { destination: '일본 도쿄', activity: '아사쿠사 관광' },
      fetchImpl,
    )

    expect(favorite).toEqual({ id: 'f1', destination: '일본 도쿄', activity: '아사쿠사 관광' })
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ destination: '일본 도쿄', activity: '아사쿠사 관광' })
  })
})

describe('removeFavorite', () => {
  it('sends a DELETE request for the given id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('no body')),
    })

    await removeFavorite('token123', 'f1', fetchImpl)

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('http://localhost:4000/api/favorites/f1')
    expect(init.method).toBe('DELETE')
  })
})

describe('isFavorited', () => {
  const favorites: FavoritePlace[] = [{ id: 'f1', destination: '일본 도쿄', activity: '아사쿠사 관광' }]

  it('returns true for a place already in the list', () => {
    expect(isFavorited(favorites, { destination: '일본 도쿄', activity: '아사쿠사 관광' })).toBe(true)
  })

  it('returns false for a place not in the list', () => {
    expect(isFavorited(favorites, { destination: '오사카', activity: '오사카성' })).toBe(false)
  })
})

describe('mergeFavoritesIntoMustVisit', () => {
  const favorites: FavoritePlace[] = [
    { id: 'f1', destination: '일본 도쿄', activity: '센소지 (아사쿠사)' },
    { id: 'f2', destination: '일본 도쿄', activity: '도쿄타워' },
    { id: 'f3', destination: '오사카', activity: '오사카성' },
  ]

  it('fills an empty mustVisit with the favorited places for the destination', () => {
    expect(mergeFavoritesIntoMustVisit('', '일본 도쿄', favorites)).toBe('센소지 (아사쿠사), 도쿄타워')
  })

  it('places favorited spots at the front, ahead of whatever the user already typed', () => {
    expect(mergeFavoritesIntoMustVisit('츠키지 시장', '일본 도쿄', favorites)).toBe(
      '센소지 (아사쿠사), 도쿄타워, 츠키지 시장',
    )
  })

  it('does not duplicate a place already listed', () => {
    expect(mergeFavoritesIntoMustVisit('센소지 (아사쿠사)', '일본 도쿄', favorites)).toBe(
      '센소지 (아사쿠사), 도쿄타워',
    )
  })

  it('ignores favorites from a different destination', () => {
    expect(mergeFavoritesIntoMustVisit('', '일본 도쿄', [favorites[2]])).toBe('')
  })

  it('returns the original text unchanged when there are no favorites at all', () => {
    expect(mergeFavoritesIntoMustVisit('츠키지 시장', '일본 도쿄', [])).toBe('츠키지 시장')
  })
})
