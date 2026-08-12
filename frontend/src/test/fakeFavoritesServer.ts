// A tiny in-memory stand-in for the backend's /api/favorites routes, used to drive
// components that call favoritesStorage in tests without hitting a real server.
// 실제 백엔드처럼 (user_id, destination, activity) 중복이면 새로 안 만들고 기존 걸 그대로
// 반환한다 — favoritesStorage.addFavorite가 "이미 있으면 조용히 성공"을 기대하기 때문.
interface FakeFavorite {
  id: string
  userId: string
  destination: string
  activity: string
}

function jsonResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response
}

export interface FakeFavoritesServer {
  fetchImpl: typeof fetch
  favorites: Map<string, FakeFavorite>
}

export function createFakeFavoritesServer(): FakeFavoritesServer {
  const favorites = new Map<string, FakeFavorite>()
  let nextId = 1

  const fetchImpl = vi.fn(async (url: string | URL, init: RequestInit = {}): Promise<Response> => {
    const path = url.toString().replace('http://localhost:4000', '')
    const method = init.method ?? 'GET'
    const body = init.body ? JSON.parse(init.body as string) : {}
    const authHeader = (init.headers as Record<string, string> | undefined)?.Authorization
    const userId = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

    if (!userId) return jsonResponse(401, { error: '로그인이 필요해요.' })

    if (method === 'GET' && path === '/api/favorites') {
      const mine = [...favorites.values()]
        .filter((f) => f.userId === userId)
        .map(({ id, destination, activity }) => ({ id, destination, activity }))
      return jsonResponse(200, { favorites: mine })
    }

    if (method === 'POST' && path === '/api/favorites') {
      const existing = [...favorites.values()].find(
        (f) => f.userId === userId && f.destination === body.destination && f.activity === body.activity,
      )
      if (existing) {
        return jsonResponse(201, {
          favorite: { id: existing.id, destination: existing.destination, activity: existing.activity },
        })
      }
      const id = String(nextId++)
      favorites.set(id, { id, userId, destination: body.destination, activity: body.activity })
      return jsonResponse(201, { favorite: { id, destination: body.destination, activity: body.activity } })
    }

    const match = path.match(/^\/api\/favorites\/([^/]+)$/)
    if (match && method === 'DELETE') {
      const id = match[1]
      const favorite = favorites.get(id)
      if (!favorite || favorite.userId !== userId) {
        return jsonResponse(404, { error: '즐겨찾기를 찾을 수 없어요.' })
      }
      favorites.delete(id)
      return jsonResponse(204, null)
    }

    return jsonResponse(404, { error: `no fake route for ${method} ${path}` })
  })

  return { fetchImpl: fetchImpl as unknown as typeof fetch, favorites }
}
