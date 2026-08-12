// tripsStorage.ts가 /api/trips와 주고받는 요청 형태(메서드, 바디, 필드 매핑)를 fakeFetch로
// 검증한다. 실제 백엔드 대신 fetch 자체를 모킹해 순수하게 클라이언트 쪽 계약만 확인한다.
import { addTrip, deleteTrip, getTrip, readTrips, updateTrip } from './tripsStorage'
import { emptyTripPlanFormValues, type TripItinerary, type TripPlanFormValues } from './tripPlan'

function fakeFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

const itinerary: TripItinerary = {
  destination: '일본 도쿄',
  duration: '2박 3일',
  travelers: 2,
  budget: 100,
  days: [{ day: 1, title: '1일차', activities: ['아사쿠사 관광'] }],
}

const formValues: TripPlanFormValues = { ...emptyTripPlanFormValues, destination: '일본 도쿄' }

const apiTrip = {
  id: 't1',
  itinerary,
  formValues,
  history: { 1: ['아사쿠사 관광'] },
  costs: {},
  times: {},
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('readTrips', () => {
  it('returns an empty list without calling the API when there is no token', async () => {
    const fetchImpl = vi.fn()
    expect(await readTrips(null, fetchImpl)).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fetches and maps trips for a logged-in user', async () => {
    const fetchImpl = fakeFetch(200, { trips: [apiTrip] })
    const trips = await readTrips('token123', fetchImpl)

    expect(trips).toEqual([
      {
        id: 't1',
        itinerary,
        values: formValues,
        history: apiTrip.history,
        costs: {},
        times: {},
        createdAt: apiTrip.createdAt,
      },
    ])

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('http://localhost:4000/api/trips')
    expect(init.headers.Authorization).toBe('Bearer token123')
  })
})

describe('addTrip', () => {
  it('posts the itinerary, form values, and history, returning the created trip', async () => {
    const fetchImpl = fakeFetch(201, { trip: apiTrip })

    const result = await addTrip('token123', { itinerary, values: formValues, history: apiTrip.history }, fetchImpl)

    expect(result).toEqual({
      id: 't1',
      itinerary,
      values: formValues,
      history: apiTrip.history,
      costs: {},
      times: {},
      createdAt: apiTrip.createdAt,
    })

    const [, init] = fetchImpl.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ itinerary, formValues, history: apiTrip.history })
  })
})

describe('getTrip', () => {
  it('returns null without calling the API when there is no token', async () => {
    const fetchImpl = vi.fn()
    expect(await getTrip(null, 't1', fetchImpl)).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns the matching trip', async () => {
    const fetchImpl = fakeFetch(200, { trip: apiTrip })
    const result = await getTrip('token123', 't1', fetchImpl)
    expect(result?.id).toBe('t1')
  })

  it('returns null when the trip is not found', async () => {
    const fetchImpl = fakeFetch(404, { error: '일정을 찾을 수 없어요.' })
    expect(await getTrip('token123', 'missing', fetchImpl)).toBeNull()
  })
})

describe('updateTrip', () => {
  it('puts the itinerary, history, and costs, returning the updated trip', async () => {
    const fetchImpl = fakeFetch(200, { trip: apiTrip })

    const result = await updateTrip(
      'token123',
      't1',
      { itinerary, history: apiTrip.history, costs: { 1: { '아사쿠사 관광': 5000 } } },
      fetchImpl,
    )

    expect(result?.id).toBe('t1')
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({
      itinerary,
      history: apiTrip.history,
      costs: { 1: { '아사쿠사 관광': 5000 } },
      times: {},
    })
  })

  it('defaults costs to an empty object when not given', async () => {
    const fetchImpl = fakeFetch(200, { trip: apiTrip })
    await updateTrip('token123', 't1', { itinerary, history: {} }, fetchImpl)

    const [, init] = fetchImpl.mock.calls[0]
    expect(JSON.parse(init.body).costs).toEqual({})
  })

  it('puts times when given', async () => {
    const fetchImpl = fakeFetch(200, { trip: apiTrip })
    await updateTrip(
      'token123',
      't1',
      { itinerary, history: {}, times: { 1: { '아사쿠사 관광': '10:30' } } },
      fetchImpl,
    )

    const [, init] = fetchImpl.mock.calls[0]
    expect(JSON.parse(init.body).times).toEqual({ 1: { '아사쿠사 관광': '10:30' } })
  })

  it('defaults times to an empty object when not given', async () => {
    const fetchImpl = fakeFetch(200, { trip: apiTrip })
    await updateTrip('token123', 't1', { itinerary, history: {} }, fetchImpl)

    const [, init] = fetchImpl.mock.calls[0]
    expect(JSON.parse(init.body).times).toEqual({})
  })

  it('returns null when the trip is not found', async () => {
    const fetchImpl = fakeFetch(404, { error: '일정을 찾을 수 없어요.' })
    expect(await updateTrip('token123', 'missing', { itinerary, history: {} }, fetchImpl)).toBeNull()
  })
})

describe('deleteTrip', () => {
  it('sends a DELETE request for the given id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('no body')),
    })

    await deleteTrip('token123', 't1', fetchImpl)

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('http://localhost:4000/api/trips/t1')
    expect(init.method).toBe('DELETE')
  })
})
