// A combined in-memory stand-in for the backend's /api/trips, /api/favorites, and
// /api/community routes, for tests that exercise a page needing more than one resource
// behind a single fetchImpl (e.g. a trip detail page that loads a trip, toggles favorites
// on its activities, and publishes to the community).
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

interface FakeFavorite {
  id: string
  userId: string
  destination: string
  activity: string
}

interface FakeCommunityTrip {
  id: string
  userId: string
  sourceTripId?: string
  author: string
  tag: string
  itinerary: unknown
  baseLikes: number
  likedBy: Set<string>
  views: number
}

function jsonResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response
}

function tripToApi(trip: FakeTrip) {
  const { id, itinerary, formValues, history, costs, times, createdAt } = trip
  return { id, itinerary, formValues, history, costs, times, createdAt }
}

function communityTripToApi(trip: FakeCommunityTrip, userId: string | null) {
  return {
    id: trip.id,
    author: trip.author,
    tag: trip.tag,
    itinerary: trip.itinerary,
    likes: trip.baseLikes + trip.likedBy.size,
    views: trip.views,
    liked: userId ? trip.likedBy.has(userId) : false,
  }
}

export interface FakeApiServerOptions {
  communityTrips?: Array<{
    id: string
    userId?: string
    author: string
    tag: string
    itinerary: unknown
    likes?: number
    views?: number
  }>
}

export interface FakeApiServer {
  fetchImpl: typeof fetch
  trips: Map<string, FakeTrip>
  favorites: Map<string, FakeFavorite>
  communityTrips: Map<string, FakeCommunityTrip>
}

export function createFakeApiServer(options: FakeApiServerOptions = {}): FakeApiServer {
  const trips = new Map<string, FakeTrip>()
  const favorites = new Map<string, FakeFavorite>()
  const communityTrips = new Map<string, FakeCommunityTrip>()
  let nextTripId = 1
  let nextFavoriteId = 1
  let nextCommunityId = 1

  for (const seed of options.communityTrips ?? []) {
    communityTrips.set(seed.id, {
      id: seed.id,
      userId: seed.userId ?? 'seed-user',
      author: seed.author,
      tag: seed.tag,
      itinerary: seed.itinerary,
      baseLikes: seed.likes ?? 0,
      likedBy: new Set(),
      views: seed.views ?? 0,
    })
  }

  const fetchImpl = vi.fn(async (url: string | URL, init: RequestInit = {}): Promise<Response> => {
    const path = url.toString().replace('http://localhost:4000', '')
    const method = init.method ?? 'GET'
    const body = init.body ? JSON.parse(init.body as string) : {}
    const authHeader = (init.headers as Record<string, string> | undefined)?.Authorization
    const userId = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

    // --- trips ---
    if (method === 'GET' && path === '/api/trips') {
      if (!userId) return jsonResponse(401, { error: '로그인이 필요해요.' })
      const mine = [...trips.values()]
        .filter((trip) => trip.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return jsonResponse(200, { trips: mine.map(tripToApi) })
    }

    if (method === 'POST' && path === '/api/trips') {
      if (!userId) return jsonResponse(401, { error: '로그인이 필요해요.' })
      const id = String(nextTripId++)
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
      return jsonResponse(201, { trip: tripToApi(trip) })
    }

    const tripMatch = path.match(/^\/api\/trips\/([^/]+)$/)
    if (tripMatch) {
      if (!userId) return jsonResponse(401, { error: '로그인이 필요해요.' })
      const id = tripMatch[1]
      const trip = trips.get(id)
      const owned = trip && trip.userId === userId

      if (method === 'GET') {
        if (!owned) return jsonResponse(404, { error: '일정을 찾을 수 없어요.' })
        return jsonResponse(200, { trip: tripToApi(trip) })
      }
      if (method === 'PUT') {
        if (!owned) return jsonResponse(404, { error: '일정을 찾을 수 없어요.' })
        trip.itinerary = body.itinerary
        trip.history = body.history ?? {}
        trip.costs = body.costs ?? {}
        trip.times = body.times ?? {}
        return jsonResponse(200, { trip: tripToApi(trip) })
      }
      if (method === 'DELETE') {
        if (!owned) return jsonResponse(404, { error: '일정을 찾을 수 없어요.' })
        trips.delete(id)
        return jsonResponse(204, null)
      }
    }

    // --- favorites ---
    if (method === 'GET' && path === '/api/favorites') {
      if (!userId) return jsonResponse(401, { error: '로그인이 필요해요.' })
      const mine = [...favorites.values()]
        .filter((f) => f.userId === userId)
        .map(({ id, destination, activity }) => ({ id, destination, activity }))
      return jsonResponse(200, { favorites: mine })
    }

    if (method === 'POST' && path === '/api/favorites') {
      if (!userId) return jsonResponse(401, { error: '로그인이 필요해요.' })
      const existing = [...favorites.values()].find(
        (f) => f.userId === userId && f.destination === body.destination && f.activity === body.activity,
      )
      if (existing) {
        return jsonResponse(201, {
          favorite: { id: existing.id, destination: existing.destination, activity: existing.activity },
        })
      }
      const id = String(nextFavoriteId++)
      favorites.set(id, { id, userId, destination: body.destination, activity: body.activity })
      return jsonResponse(201, { favorite: { id, destination: body.destination, activity: body.activity } })
    }

    const favoriteMatch = path.match(/^\/api\/favorites\/([^/]+)$/)
    if (favoriteMatch && method === 'DELETE') {
      if (!userId) return jsonResponse(401, { error: '로그인이 필요해요.' })
      const id = favoriteMatch[1]
      const favorite = favorites.get(id)
      if (!favorite || favorite.userId !== userId) {
        return jsonResponse(404, { error: '즐겨찾기를 찾을 수 없어요.' })
      }
      favorites.delete(id)
      return jsonResponse(204, null)
    }

    // --- community ---
    if (method === 'GET' && path === '/api/community') {
      const list = [...communityTrips.values()]
        .map((trip) => communityTripToApi(trip, userId))
        .sort((a, b) => b.likes - a.likes)
      return jsonResponse(200, { trips: list })
    }

    const communityMineMatch = path.match(/^\/api\/community\/mine\/([^/]+)$/)
    if (communityMineMatch && method === 'GET') {
      if (!userId) return jsonResponse(401, { error: '로그인이 필요해요.' })
      const sourceTripId = communityMineMatch[1]
      const found = [...communityTrips.values()].find(
        (trip) => trip.sourceTripId === sourceTripId && trip.userId === userId,
      )
      return jsonResponse(200, { trip: found ? communityTripToApi(found, userId) : null })
    }

    if (method === 'POST' && path === '/api/community') {
      if (!userId) return jsonResponse(401, { error: '로그인이 필요해요.' })
      const { tripId, tag } = body
      const existing = [...communityTrips.values()].find((trip) => trip.sourceTripId === tripId)
      if (existing) return jsonResponse(201, { trip: communityTripToApi(existing, userId) })

      const sourceTrip = trips.get(tripId)
      if (!sourceTrip || sourceTrip.userId !== userId) {
        return jsonResponse(404, { error: '일정을 찾을 수 없어요.' })
      }

      const id = `community-${nextCommunityId++}`
      const created: FakeCommunityTrip = {
        id,
        userId,
        sourceTripId: tripId,
        author: 'me@example.com',
        tag,
        itinerary: sourceTrip.itinerary,
        baseLikes: 0,
        likedBy: new Set(),
        views: 0,
      }
      communityTrips.set(id, created)
      return jsonResponse(201, { trip: communityTripToApi(created, userId) })
    }

    const communityLikeMatch = path.match(/^\/api\/community\/([^/]+)\/like$/)
    if (communityLikeMatch && method === 'POST') {
      if (!userId) return jsonResponse(401, { error: '로그인이 필요해요.' })
      const trip = communityTrips.get(communityLikeMatch[1])
      if (!trip) return jsonResponse(404, { error: '커뮤니티 일정을 찾을 수 없어요.' })
      if (trip.likedBy.has(userId)) trip.likedBy.delete(userId)
      else trip.likedBy.add(userId)
      return jsonResponse(200, { trip: communityTripToApi(trip, userId) })
    }

    const communityViewMatch = path.match(/^\/api\/community\/([^/]+)\/view$/)
    if (communityViewMatch && method === 'POST') {
      const trip = communityTrips.get(communityViewMatch[1])
      if (trip) trip.views += 1
      return jsonResponse(200, { views: trip?.views ?? 0 })
    }

    const communityDetailMatch = path.match(/^\/api\/community\/([^/]+)$/)
    if (communityDetailMatch) {
      const id = communityDetailMatch[1]
      const trip = communityTrips.get(id)

      if (method === 'GET') {
        if (!trip) return jsonResponse(404, { error: '커뮤니티 일정을 찾을 수 없어요.' })
        return jsonResponse(200, { trip: communityTripToApi(trip, userId) })
      }
      if (method === 'PUT') {
        if (!userId) return jsonResponse(401, { error: '로그인이 필요해요.' })
        if (!trip || trip.userId !== userId) return jsonResponse(404, { error: '커뮤니티 일정을 찾을 수 없어요.' })
        if (typeof body.tag !== 'string' || !body.tag) return jsonResponse(400, { error: 'tag가 필요해요.' })
        trip.tag = body.tag
        const sourceTrip = trip.sourceTripId ? trips.get(trip.sourceTripId) : undefined
        if (sourceTrip) trip.itinerary = sourceTrip.itinerary
        return jsonResponse(200, { trip: communityTripToApi(trip, userId) })
      }
      if (method === 'DELETE') {
        if (!userId) return jsonResponse(401, { error: '로그인이 필요해요.' })
        if (!trip || trip.userId !== userId) return jsonResponse(404, { error: '커뮤니티 일정을 찾을 수 없어요.' })
        communityTrips.delete(id)
        return jsonResponse(204, null)
      }
    }

    return jsonResponse(404, { error: `no fake route for ${method} ${path}` })
  })

  return { fetchImpl: fetchImpl as unknown as typeof fetch, trips, favorites, communityTrips }
}
