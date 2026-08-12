// communityTrips.ts가 /api/community와 주고받는 요청/응답 매핑을 fakeApiServer로 검증한다.
// 실제 백엔드(backend/src/routes/community.ts)의 동작을 흉내 낸 서버라, 여기서 통과하면
// 프론트-백엔드 계약이 어긋나지 않았다고 어느 정도 신뢰할 수 있다.
import {
  getCommunityTrip,
  getCommunityTrips,
  getMyPublishedTrip,
  publishTrip,
  recordCommunityView,
  toggleCommunityLike,
  unpublishTrip,
  updateCommunityTrip,
} from './communityTrips'
import { createFakeApiServer } from '../test/fakeApiServer'
import { createActivityHistory, generatePlan } from './generatePlan'
import { emptyTripPlanFormValues, type TripItinerary, type TripPlanFormValues } from './tripPlan'

const seoulValues: TripPlanFormValues = {
  ...emptyTripPlanFormValues,
  destination: '서울',
  duration: '2박 3일',
  styles: ['맛집 중심'],
}

function seedTrips() {
  return [
    { id: 'jeju-healing', author: '민지', tag: '힐링 여행', likes: 128, views: 3200, itinerary: generatePlan(seoulValues) },
    { id: 'tokyo-shopping', author: '현우', tag: '쇼핑 중심', likes: 96, views: 2400, itinerary: generatePlan(seoulValues) },
  ]
}

async function publishSourceTrip(server: ReturnType<typeof createFakeApiServer>, userId: string) {
  const itinerary = generatePlan(seoulValues)
  const created = server.trips.set('trip-1', {
    id: 'trip-1',
    userId,
    itinerary,
    formValues: seoulValues,
    history: createActivityHistory(itinerary),
    costs: {},
    times: {},
    createdAt: new Date().toISOString(),
  })
  return created.get('trip-1')!
}

describe('getCommunityTrips', () => {
  it('returns every community trip from the backend, most-liked first', async () => {
    const server = createFakeApiServer({ communityTrips: seedTrips() })
    const trips = await getCommunityTrips(null, server.fetchImpl)

    expect(trips.map((t) => t.id)).toEqual(['jeju-healing', 'tokyo-shopping'])
  })

  it('marks trips the current user has liked', async () => {
    const server = createFakeApiServer({ communityTrips: seedTrips() })
    await toggleCommunityLike('user-1', 'jeju-healing', server.fetchImpl)

    const trips = await getCommunityTrips('user-1', server.fetchImpl)
    expect(trips.find((t) => t.id === 'jeju-healing')?.liked).toBe(true)
    expect(trips.find((t) => t.id === 'tokyo-shopping')?.liked).toBe(false)
  })
})

describe('getCommunityTrip', () => {
  it('returns the matching trip by id', async () => {
    const server = createFakeApiServer({ communityTrips: seedTrips() })
    const trip = await getCommunityTrip('jeju-healing', null, server.fetchImpl)
    expect(trip?.author).toBe('민지')
  })

  it('returns null for an unknown id', async () => {
    const server = createFakeApiServer()
    expect(await getCommunityTrip('does-not-exist', null, server.fetchImpl)).toBeNull()
  })
})

describe('toggleCommunityLike', () => {
  it('toggles a like on and off', async () => {
    const server = createFakeApiServer({ communityTrips: seedTrips() })

    const liked = await toggleCommunityLike('user-1', 'jeju-healing', server.fetchImpl)
    expect(liked.likes).toBe(129)
    expect(liked.liked).toBe(true)

    const unliked = await toggleCommunityLike('user-1', 'jeju-healing', server.fetchImpl)
    expect(unliked.likes).toBe(128)
    expect(unliked.liked).toBe(false)
  })
})

describe('recordCommunityView', () => {
  it('increments and returns the view count', async () => {
    const server = createFakeApiServer({ communityTrips: seedTrips() })
    expect(await recordCommunityView('jeju-healing', server.fetchImpl)).toBe(3201)
    expect(await recordCommunityView('jeju-healing', server.fetchImpl)).toBe(3202)
  })
})

describe('publishTrip / unpublishTrip / getMyPublishedTrip', () => {
  it('publishes a trip the account owns and can look it up by source trip id', async () => {
    const server = createFakeApiServer()
    const sourceTrip = await publishSourceTrip(server, 'user-1')

    const published = await publishTrip('user-1', sourceTrip.id, '맛집 중심', server.fetchImpl)
    expect(published.tag).toBe('맛집 중심')

    const mine = await getMyPublishedTrip('user-1', sourceTrip.id, server.fetchImpl)
    expect(mine?.id).toBe(published.id)
  })

  it('returns null from getMyPublishedTrip before publishing', async () => {
    const server = createFakeApiServer()
    const sourceTrip = await publishSourceTrip(server, 'user-1')
    expect(await getMyPublishedTrip('user-1', sourceTrip.id, server.fetchImpl)).toBeNull()
  })

  it('returns null from getMyPublishedTrip when logged out', async () => {
    const server = createFakeApiServer()
    expect(await getMyPublishedTrip(null, 'trip-1', server.fetchImpl)).toBeNull()
  })

  it('removes a published trip so it no longer shows up', async () => {
    const server = createFakeApiServer()
    const sourceTrip = await publishSourceTrip(server, 'user-1')
    const published = await publishTrip('user-1', sourceTrip.id, '맛집 중심', server.fetchImpl)

    await unpublishTrip('user-1', published.id, server.fetchImpl)

    expect(await getMyPublishedTrip('user-1', sourceTrip.id, server.fetchImpl)).toBeNull()
  })
})

describe('updateCommunityTrip', () => {
  it('updates the tag and re-syncs the itinerary from the current source trip', async () => {
    const server = createFakeApiServer()
    const sourceTrip = await publishSourceTrip(server, 'user-1')
    const published = await publishTrip('user-1', sourceTrip.id, '맛집 중심', server.fetchImpl)

    const editedItinerary = { ...(sourceTrip.itinerary as TripItinerary), destination: '부산' }
    server.trips.get('trip-1')!.itinerary = editedItinerary

    const updated = await updateCommunityTrip('user-1', published.id, '쇼핑 중심', server.fetchImpl)

    expect(updated.tag).toBe('쇼핑 중심')
    expect(updated.itinerary).toEqual(editedItinerary)

    const fetched = await getCommunityTrip(published.id, null, server.fetchImpl)
    expect(fetched?.tag).toBe('쇼핑 중심')
    expect(fetched?.itinerary).toEqual(editedItinerary)
  })
})
