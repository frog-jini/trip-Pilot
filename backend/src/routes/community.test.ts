// /api/community 라우터를 supertest로 검증한다. 소유권이 걸린 액션(공유/수정/삭제)마다 "다른
// 계정으로 시도하면 404"까지 교차 검증하는 테스트가 많은데, 403(권한 없음) 대신 404를 쓰는 이유는
// 라우트 자체가 "존재하지만 권한 없음"과 "아예 없음"을 구분해서 알려주지 않기 때문 — 존재 여부
// 자체를 감추기 위한 설계다.
import request from 'supertest'
import { app } from '../app.js'
import { pool } from '../db/pool.js'

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

async function createTrip(token: string): Promise<string> {
  const response = await request(app)
    .post('/api/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({ itinerary: sampleItinerary, formValues: sampleFormValues, history: {} })
  return response.body.trip.id as string
}

describe('GET /api/community', () => {
  it('starts empty', async () => {
    const response = await request(app).get('/api/community')
    expect(response.status).toBe(200)
    expect(response.body.trips).toEqual([])
  })

  it('does not require a token', async () => {
    const response = await request(app).get('/api/community')
    expect(response.status).toBe(200)
  })
})

describe('POST /api/community (publish)', () => {
  it('requires a token', async () => {
    const response = await request(app).post('/api/community').send({ tripId: 'x', tag: '관광 중심' })
    expect(response.status).toBe(401)
  })

  it('publishes a trip the account owns', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)

    const response = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })

    expect(response.status).toBe(201)
    expect(response.body.trip).toMatchObject({
      author: 'jini@example.com',
      tag: '관광 중심',
      itinerary: sampleItinerary,
      likes: 0,
      views: 0,
    })

    const list = await request(app).get('/api/community').set('Authorization', `Bearer ${token}`)
    expect(list.body.trips).toHaveLength(1)
  })

  // 헤더(Header.tsx)에 표시되는 이름과 커뮤니티 작성자 표기가 서로 다른 값을 쓰면(예: 하나는
  // 이메일, 하나는 닉네임) 사용자가 "이메일을 바꿨는데 커뮤니티만 안 바뀌었다" 같은 혼란을
  // 겪는다 — 닉네임이 설정돼 있으면 이메일 대신 닉네임을 작성자로 쓴다.
  it('uses the nickname instead of the email as the author when a nickname is set', async () => {
    const token = await signUpAndGetToken()
    await request(app).put('/api/auth/nickname').set('Authorization', `Bearer ${token}`).send({ nickname: '개굴' })
    const tripId = await createTrip(token)

    const response = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })

    expect(response.body.trip).toMatchObject({ author: '개굴' })
  })

  it('rejects publishing a trip owned by someone else', async () => {
    const tokenA = await signUpAndGetToken('a@example.com')
    const tokenB = await signUpAndGetToken('b@example.com')
    const tripId = await createTrip(tokenA)

    const response = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ tripId, tag: '관광 중심' })

    expect(response.status).toBe(404)
  })

  it('does not publish the same trip twice', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)

    const first = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })
    const second = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })

    expect(first.body.trip.id).toBe(second.body.trip.id)
    const list = await request(app).get('/api/community').set('Authorization', `Bearer ${token}`)
    expect(list.body.trips).toHaveLength(1)
  })
})

describe('DELETE /api/community/:id (unpublish)', () => {
  it('removes a trip the account published', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })

    const response = await request(app)
      .delete(`/api/community/${published.body.trip.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(204)

    const list = await request(app).get('/api/community').set('Authorization', `Bearer ${token}`)
    expect(list.body.trips).toEqual([])
  })

  it('rejects unpublishing someone else’s community trip', async () => {
    const tokenA = await signUpAndGetToken('a@example.com')
    const tokenB = await signUpAndGetToken('b@example.com')
    const tripId = await createTrip(tokenA)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tripId, tag: '관광 중심' })

    const response = await request(app)
      .delete(`/api/community/${published.body.trip.id}`)
      .set('Authorization', `Bearer ${tokenB}`)

    expect(response.status).toBe(404)
  })
})

describe('PUT /api/community/:id (update)', () => {
  it('requires a token', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })

    const response = await request(app)
      .put(`/api/community/${published.body.trip.id}`)
      .send({ tag: '맛집 중심' })

    expect(response.status).toBe(401)
  })

  it('returns 404 for an unknown id', async () => {
    const token = await signUpAndGetToken()

    const response = await request(app)
      .put('/api/community/does-not-exist')
      .set('Authorization', `Bearer ${token}`)
      .send({ tag: '맛집 중심' })

    expect(response.status).toBe(404)
  })

  it('rejects updating someone else’s community trip', async () => {
    const tokenA = await signUpAndGetToken('a@example.com')
    const tokenB = await signUpAndGetToken('b@example.com')
    const tripId = await createTrip(tokenA)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tripId, tag: '관광 중심' })

    const response = await request(app)
      .put(`/api/community/${published.body.trip.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ tag: '맛집 중심' })

    expect(response.status).toBe(404)
  })

  it('requires a tag', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })

    const response = await request(app)
      .put(`/api/community/${published.body.trip.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(response.status).toBe(400)
  })

  it('updates the tag', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })

    const response = await request(app)
      .put(`/api/community/${published.body.trip.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tag: '맛집 중심' })

    expect(response.status).toBe(200)
    expect(response.body.trip.tag).toBe('맛집 중심')

    const detail = await request(app)
      .get(`/api/community/${published.body.trip.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(detail.body.trip.tag).toBe('맛집 중심')
  })

  it('re-syncs the itinerary from the current state of the source trip', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })

    const editedItinerary = {
      ...sampleItinerary,
      days: [{ day: 1, title: '1일차', activities: ['긴자 쇼핑', '아사쿠사 관광'] }],
    }
    await request(app)
      .put(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itinerary: editedItinerary })

    const response = await request(app)
      .put(`/api/community/${published.body.trip.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tag: '관광 중심' })

    expect(response.status).toBe(200)
    expect(response.body.trip.itinerary).toEqual(editedItinerary)
  })

  it('keeps the existing itinerary when the source trip no longer exists', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })

    await request(app).delete(`/api/trips/${tripId}`).set('Authorization', `Bearer ${token}`)

    const response = await request(app)
      .put(`/api/community/${published.body.trip.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tag: '맛집 중심' })

    expect(response.status).toBe(200)
    expect(response.body.trip.tag).toBe('맛집 중심')
    expect(response.body.trip.itinerary).toEqual(sampleItinerary)
  })
})

describe('POST /api/community/:id/like', () => {
  it('requires a token', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })

    const response = await request(app).post(`/api/community/${published.body.trip.id}/like`)
    expect(response.status).toBe(401)
  })

  it('toggles a like on and off', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })
    const communityId = published.body.trip.id

    const liked = await request(app)
      .post(`/api/community/${communityId}/like`)
      .set('Authorization', `Bearer ${token}`)
    expect(liked.body.trip.likes).toBe(1)
    expect(liked.body.trip.liked).toBe(true)

    const unliked = await request(app)
      .post(`/api/community/${communityId}/like`)
      .set('Authorization', `Bearer ${token}`)
    expect(unliked.body.trip.likes).toBe(0)
    expect(unliked.body.trip.liked).toBe(false)
  })

  it('lets different accounts like the same trip independently', async () => {
    const tokenA = await signUpAndGetToken('a@example.com')
    const tokenB = await signUpAndGetToken('b@example.com')
    const tripId = await createTrip(tokenA)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tripId, tag: '관광 중심' })
    const communityId = published.body.trip.id

    await request(app).post(`/api/community/${communityId}/like`).set('Authorization', `Bearer ${tokenA}`)
    const response = await request(app)
      .post(`/api/community/${communityId}/like`)
      .set('Authorization', `Bearer ${tokenB}`)

    expect(response.body.trip.likes).toBe(2)
  })
})

describe('POST /api/community/:id/view', () => {
  it('requires a token', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })

    const response = await request(app).post(`/api/community/${published.body.trip.id}/view`)
    expect(response.status).toBe(401)
  })

  it('increments the view count', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })
    const communityId = published.body.trip.id

    const first = await request(app)
      .post(`/api/community/${communityId}/view`)
      .set('Authorization', `Bearer ${token}`)
    expect(first.status).toBe(200)
    expect(first.body.views).toBe(1)

    const second = await request(app)
      .post(`/api/community/${communityId}/view`)
      .set('Authorization', `Bearer ${token}`)
    expect(second.body.views).toBe(2)

    const detail = await request(app)
      .get(`/api/community/${communityId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(detail.body.trip.views).toBe(2)
  })
})

describe('GET /api/community/:id', () => {
  it('requires a token', async () => {
    const response = await request(app).get('/api/community/does-not-exist')
    expect(response.status).toBe(401)
  })

  it('returns 404 for an unknown id', async () => {
    const token = await signUpAndGetToken()
    const response = await request(app)
      .get('/api/community/does-not-exist')
      .set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(404)
  })

  it('reflects the requesting account’s own like state when authenticated', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })
    const communityId = published.body.trip.id

    await request(app).post(`/api/community/${communityId}/like`).set('Authorization', `Bearer ${token}`)

    const response = await request(app)
      .get(`/api/community/${communityId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.body.trip.liked).toBe(true)
  })
})

describe('seed likes', () => {
  // seed_likes는 API로 설정할 방법이 없어서(seed.ts가 데모 데이터에만 채워 넣는 컬럼) 여기서는
  // pool.query로 직접 UPDATE한다 — "API 응답이 seed_likes + 실제 좋아요 수를 더해서 보여준다"는
  // community.ts의 LIST_COLUMNS 계산식을 검증하려면 이 컬럼 값을 임의로 만들어야 하기 때문.
  it('adds seed_likes on top of real likes in both the detail and like-toggle responses', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })
    const communityId = published.body.trip.id

    await pool.query('UPDATE community_trips SET seed_likes = 50 WHERE id = $1', [communityId])

    const detail = await request(app)
      .get(`/api/community/${communityId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(detail.body.trip.likes).toBe(50)

    const liked = await request(app)
      .post(`/api/community/${communityId}/like`)
      .set('Authorization', `Bearer ${token}`)
    expect(liked.body.trip.likes).toBe(51)
  })
})

describe('GET /api/community list ordering and liked state', () => {
  it('sorts trips by likes descending', async () => {
    const tokenA = await signUpAndGetToken('a@example.com')
    const tokenB = await signUpAndGetToken('b@example.com')
    const tripA = await createTrip(tokenA)
    const tripB = await createTrip(tokenB)

    const publishedA = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tripId: tripA, tag: 'A' })
    const publishedB = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ tripId: tripB, tag: 'B' })

    await pool.query('UPDATE community_trips SET seed_likes = 10 WHERE id = $1', [publishedA.body.trip.id])
    await pool.query('UPDATE community_trips SET seed_likes = 90 WHERE id = $1', [publishedB.body.trip.id])

    const list = await request(app).get('/api/community').set('Authorization', `Bearer ${tokenA}`)
    expect(list.body.trips.map((trip: { id: string }) => trip.id)).toEqual([
      publishedB.body.trip.id,
      publishedA.body.trip.id,
    ])
  })

  it('includes liked state per trip when authenticated', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })
    await request(app).post(`/api/community/${published.body.trip.id}/like`).set('Authorization', `Bearer ${token}`)

    const list = await request(app).get('/api/community').set('Authorization', `Bearer ${token}`)
    const trip = list.body.trips.find((t: { id: string }) => t.id === published.body.trip.id)
    expect(trip.liked).toBe(true)
  })

  it('shows liked as false when the list is fetched without a token', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })
    await request(app).post(`/api/community/${published.body.trip.id}/like`).set('Authorization', `Bearer ${token}`)

    const list = await request(app).get('/api/community')
    const trip = list.body.trips.find((t: { id: string }) => t.id === published.body.trip.id)
    expect(trip.liked).toBe(false)
  })
})

describe('GET /api/community/mine/:tripId', () => {
  it('requires a token', async () => {
    const response = await request(app).get('/api/community/mine/whatever')
    expect(response.status).toBe(401)
  })

  it('returns null when the trip has not been published', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)

    const response = await request(app).get(`/api/community/mine/${tripId}`).set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(200)
    expect(response.body.trip).toBeNull()
  })

  it('returns the community trip when the account has published it', async () => {
    const token = await signUpAndGetToken()
    const tripId = await createTrip(token)
    const published = await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, tag: '관광 중심' })

    const response = await request(app).get(`/api/community/mine/${tripId}`).set('Authorization', `Bearer ${token}`)
    expect(response.body.trip.id).toBe(published.body.trip.id)
  })

  it('does not return another account’s published trip', async () => {
    const tokenA = await signUpAndGetToken('a@example.com')
    const tokenB = await signUpAndGetToken('b@example.com')
    const tripId = await createTrip(tokenA)
    await request(app)
      .post('/api/community')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tripId, tag: '관광 중심' })

    const response = await request(app).get(`/api/community/mine/${tripId}`).set('Authorization', `Bearer ${tokenB}`)
    expect(response.body.trip).toBeNull()
  })
})
