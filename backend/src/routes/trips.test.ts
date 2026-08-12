// /api/trips 라우터(전부 로그인 필요)를 supertest로 검증한다. "다른 계정 소유 트립에 접근하면
// 404"를 GET/PUT/DELETE 각각에서 반복 확인하는데, 이는 존재 여부 자체를 숨기는 설계(권한 없음을
// 뜻하는 403 대신 404)가 모든 엔드포인트에 일관되게 적용됐는지 보기 위함이다.
import request from 'supertest'
import { app } from '../app.js'

const sampleItinerary = {
  destination: '일본 도쿄',
  duration: '2박 3일',
  travelers: 2,
  budget: 100,
  days: [{ day: 1, title: '1일차', activities: ['아사쿠사 관광'] }],
}

const sampleFormValues = {
  destination: '일본 도쿄',
  duration: '2박 3일',
  travelers: '2',
  budget: '100',
  accommodation: '',
  styles: ['관광 중심'],
  mustVisit: '',
  startDate: '',
}

async function signUpAndGetToken(email = 'jini@example.com'): Promise<string> {
  const response = await request(app).post('/api/auth/signup').send({ email, password: 'password1' })
  return response.body.token as string
}

describe('trips routes', () => {
  it('rejects every route without a token', async () => {
    expect((await request(app).get('/api/trips')).status).toBe(401)
    expect((await request(app).post('/api/trips').send({})).status).toBe(401)
    expect((await request(app).get('/api/trips/some-id')).status).toBe(401)
    expect((await request(app).put('/api/trips/some-id').send({})).status).toBe(401)
    expect((await request(app).delete('/api/trips/some-id')).status).toBe(401)
  })

  it('starts with an empty trip list for a new account', async () => {
    const token = await signUpAndGetToken()

    const response = await request(app).get('/api/trips').set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.trips).toEqual([])
  })

  it('creates a trip and returns it', async () => {
    const token = await signUpAndGetToken()

    const response = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({ itinerary: sampleItinerary, formValues: sampleFormValues, history: { 1: ['아사쿠사 관광'] } })

    expect(response.status).toBe(201)
    expect(response.body.trip.itinerary).toEqual(sampleItinerary)
    expect(response.body.trip.history).toEqual({ 1: ['아사쿠사 관광'] })
    expect(response.body.trip.costs).toEqual({})
    expect(response.body.trip.times).toEqual({})
    expect(typeof response.body.trip.id).toBe('string')
  })

  it('rejects creating a trip without an itinerary', async () => {
    const token = await signUpAndGetToken()

    const response = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({ formValues: sampleFormValues })

    expect(response.status).toBe(400)
  })

  it('lists only the trips owned by the requesting account', async () => {
    const tokenA = await signUpAndGetToken('a@example.com')
    const tokenB = await signUpAndGetToken('b@example.com')

    await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itinerary: sampleItinerary, formValues: sampleFormValues, history: {} })

    const responseA = await request(app).get('/api/trips').set('Authorization', `Bearer ${tokenA}`)
    const responseB = await request(app).get('/api/trips').set('Authorization', `Bearer ${tokenB}`)

    expect(responseA.body.trips).toHaveLength(1)
    expect(responseB.body.trips).toEqual([])
  })

  it('gets a single trip by id', async () => {
    const token = await signUpAndGetToken()
    const created = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({ itinerary: sampleItinerary, formValues: sampleFormValues, history: {} })

    const response = await request(app)
      .get(`/api/trips/${created.body.trip.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.trip.itinerary).toEqual(sampleItinerary)
  })

  it('does not let one account read another account’s trip', async () => {
    const tokenA = await signUpAndGetToken('a@example.com')
    const tokenB = await signUpAndGetToken('b@example.com')
    const created = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itinerary: sampleItinerary, formValues: sampleFormValues, history: {} })

    const response = await request(app)
      .get(`/api/trips/${created.body.trip.id}`)
      .set('Authorization', `Bearer ${tokenB}`)

    expect(response.status).toBe(404)
  })

  it('updates a trip’s itinerary, history, and costs', async () => {
    const token = await signUpAndGetToken()
    const created = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({ itinerary: sampleItinerary, formValues: sampleFormValues, history: {} })

    const updatedItinerary = { ...sampleItinerary, days: [] }
    const response = await request(app)
      .put(`/api/trips/${created.body.trip.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itinerary: updatedItinerary, history: {}, costs: { 1: { '아사쿠사 관광': 5000 } } })

    expect(response.status).toBe(200)
    expect(response.body.trip.itinerary.days).toEqual([])
    expect(response.body.trip.costs).toEqual({ 1: { '아사쿠사 관광': 5000 } })
  })

  it('updates a trip’s times (사용자가 직접 지정한 활동별 시간)', async () => {
    const token = await signUpAndGetToken()
    const created = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({ itinerary: sampleItinerary, formValues: sampleFormValues, history: {} })

    const response = await request(app)
      .put(`/api/trips/${created.body.trip.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itinerary: sampleItinerary, history: {}, times: { 1: { '아사쿠사 관광': '10:30' } } })

    expect(response.status).toBe(200)
    expect(response.body.trip.times).toEqual({ 1: { '아사쿠사 관광': '10:30' } })
  })

  it('defaults times to an empty object when not provided on update', async () => {
    const token = await signUpAndGetToken()
    const created = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({ itinerary: sampleItinerary, formValues: sampleFormValues, history: {} })

    const response = await request(app)
      .put(`/api/trips/${created.body.trip.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itinerary: sampleItinerary, history: {} })

    expect(response.body.trip.times).toEqual({})
  })

  it('does not let one account update another account’s trip', async () => {
    const tokenA = await signUpAndGetToken('a@example.com')
    const tokenB = await signUpAndGetToken('b@example.com')
    const created = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itinerary: sampleItinerary, formValues: sampleFormValues, history: {} })

    const response = await request(app)
      .put(`/api/trips/${created.body.trip.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ itinerary: sampleItinerary, history: {} })

    expect(response.status).toBe(404)
  })

  it('deletes a trip', async () => {
    const token = await signUpAndGetToken()
    const created = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({ itinerary: sampleItinerary, formValues: sampleFormValues, history: {} })

    const deleteResponse = await request(app)
      .delete(`/api/trips/${created.body.trip.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleteResponse.status).toBe(204)

    const listResponse = await request(app).get('/api/trips').set('Authorization', `Bearer ${token}`)
    expect(listResponse.body.trips).toEqual([])
  })

  it('returns 404 when deleting a trip that does not belong to the account', async () => {
    const tokenA = await signUpAndGetToken('a@example.com')
    const tokenB = await signUpAndGetToken('b@example.com')
    const created = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ itinerary: sampleItinerary, formValues: sampleFormValues, history: {} })

    const response = await request(app)
      .delete(`/api/trips/${created.body.trip.id}`)
      .set('Authorization', `Bearer ${tokenB}`)

    expect(response.status).toBe(404)
  })
})
