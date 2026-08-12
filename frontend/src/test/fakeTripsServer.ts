// A tiny in-memory stand-in for the backend's /api/trips routes, used to drive
// components that call tripsStorage in tests without hitting a real server.
// fakeApiServer.ts와 내용이 겹치지만(둘 다 /api/trips를 흉내낸다) 이쪽은 trips만 필요한
// 테스트(PlanNewPage 등)를 위한 더 가벼운 버전이다 — favorites/community까지 다 필요하면
// fakeApiServer.ts를 쓴다.
interface FakeTrip {
  id: string
  userId: string
  itinerary: unknown
  formValues: unknown
  history: unknown
  costs: unknown
  times: unknown
  createdAt: string
}

interface ApiTripShape {
  id: string
  itinerary: unknown
  formValues: unknown
  history: unknown
  costs: unknown
  times: unknown
  createdAt: string
}

function toApiShape(trip: FakeTrip): ApiTripShape {
  const { id, itinerary, formValues, history, costs, times, createdAt } = trip
  return { id, itinerary, formValues, history, costs, times, createdAt }
}

function jsonResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response
}

export interface FakeTripsServer {
  fetchImpl: typeof fetch
  trips: Map<string, FakeTrip>
}

export function createFakeTripsServer(): FakeTripsServer {
  const trips = new Map<string, FakeTrip>()
  let nextId = 1

  const fetchImpl = vi.fn(async (url: string | URL, init: RequestInit = {}): Promise<Response> => {
    const path = url.toString().replace('http://localhost:4000', '')
    const method = init.method ?? 'GET'
    const body = init.body ? JSON.parse(init.body as string) : {}
    const authHeader = (init.headers as Record<string, string> | undefined)?.Authorization
    const userId = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

    if (!userId) return jsonResponse(401, { error: '로그인이 필요해요.' })

    if (method === 'GET' && path === '/api/trips') {
      const mine = [...trips.values()]
        .filter((trip) => trip.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return jsonResponse(200, { trips: mine.map(toApiShape) })
    }

    if (method === 'POST' && path === '/api/trips') {
      const id = String(nextId++)
      const trip: FakeTrip = {
        id,
        userId,
        itinerary: body.itinerary,
        formValues: body.formValues,
        history: body.history ?? {},
        costs: {},
        times: {},
        createdAt: new Date(Date.now() + Number(id)).toISOString(),
      }
      trips.set(id, trip)
      return jsonResponse(201, { trip: toApiShape(trip) })
    }

    const singleTripMatch = path.match(/^\/api\/trips\/([^/]+)$/)
    if (singleTripMatch) {
      const id = singleTripMatch[1]
      const trip = trips.get(id)
      const owned = trip && trip.userId === userId

      if (method === 'GET') {
        if (!owned) return jsonResponse(404, { error: '일정을 찾을 수 없어요.' })
        return jsonResponse(200, { trip: toApiShape(trip) })
      }

      if (method === 'PUT') {
        if (!owned) return jsonResponse(404, { error: '일정을 찾을 수 없어요.' })
        trip.itinerary = body.itinerary
        trip.history = body.history ?? {}
        trip.costs = body.costs ?? {}
        trip.times = body.times ?? {}
        return jsonResponse(200, { trip: toApiShape(trip) })
      }

      if (method === 'DELETE') {
        if (!owned) return jsonResponse(404, { error: '일정을 찾을 수 없어요.' })
        trips.delete(id)
        return jsonResponse(204, null)
      }
    }

    return jsonResponse(404, { error: `no fake route for ${method} ${path}` })
  })

  return { fetchImpl: fetchImpl as unknown as typeof fetch, trips }
}
