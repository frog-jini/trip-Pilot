// /api/favorites 라우터(전부 로그인 필요)를 supertest로 검증한다.
import request from 'supertest'
import { app } from '../app.js'

async function signUpAndGetToken(email = 'jini@example.com'): Promise<string> {
  const response = await request(app).post('/api/auth/signup').send({ email, password: 'password1' })
  return response.body.token as string
}

describe('favorites routes', () => {
  it('rejects every route without a token', async () => {
    expect((await request(app).get('/api/favorites')).status).toBe(401)
    expect((await request(app).post('/api/favorites').send({})).status).toBe(401)
    expect((await request(app).delete('/api/favorites/some-id')).status).toBe(401)
  })

  it('starts empty for a new account', async () => {
    const token = await signUpAndGetToken()
    const response = await request(app).get('/api/favorites').set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.favorites).toEqual([])
  })

  it('adds a favorite place', async () => {
    const token = await signUpAndGetToken()

    const response = await request(app)
      .post('/api/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({ destination: '일본 도쿄', activity: '아사쿠사 관광' })

    expect(response.status).toBe(201)
    expect(response.body.favorite).toMatchObject({ destination: '일본 도쿄', activity: '아사쿠사 관광' })

    const list = await request(app).get('/api/favorites').set('Authorization', `Bearer ${token}`)
    expect(list.body.favorites).toHaveLength(1)
  })

  it('rejects adding a favorite with a missing field', async () => {
    const token = await signUpAndGetToken()
    const response = await request(app)
      .post('/api/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({ destination: '일본 도쿄' })

    expect(response.status).toBe(400)
  })

  // favorites.ts의 POST가 UNIQUE(user_id, destination, activity) 충돌을 ON CONFLICT DO NOTHING으로
  // 조용히 무시한다는 걸 검증한다 — 두 번째 요청도 에러 없이 201을 주지만 실제로 늘어나진 않는다.
  it('does not duplicate the same place favorited twice', async () => {
    const token = await signUpAndGetToken()

    await request(app)
      .post('/api/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({ destination: '일본 도쿄', activity: '아사쿠사 관광' })
    await request(app)
      .post('/api/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({ destination: '일본 도쿄', activity: '아사쿠사 관광' })

    const list = await request(app).get('/api/favorites').set('Authorization', `Bearer ${token}`)
    expect(list.body.favorites).toHaveLength(1)
  })

  it('keeps favorites separate between accounts', async () => {
    const tokenA = await signUpAndGetToken('a@example.com')
    const tokenB = await signUpAndGetToken('b@example.com')

    await request(app)
      .post('/api/favorites')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ destination: '일본 도쿄', activity: '아사쿠사 관광' })

    const listB = await request(app).get('/api/favorites').set('Authorization', `Bearer ${tokenB}`)
    expect(listB.body.favorites).toEqual([])
  })

  it('deletes a favorite', async () => {
    const token = await signUpAndGetToken()
    const created = await request(app)
      .post('/api/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({ destination: '일본 도쿄', activity: '아사쿠사 관광' })

    const deleteResponse = await request(app)
      .delete(`/api/favorites/${created.body.favorite.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleteResponse.status).toBe(204)

    const list = await request(app).get('/api/favorites').set('Authorization', `Bearer ${token}`)
    expect(list.body.favorites).toEqual([])
  })

  it('does not let one account delete another account’s favorite', async () => {
    const tokenA = await signUpAndGetToken('a@example.com')
    const tokenB = await signUpAndGetToken('b@example.com')
    const created = await request(app)
      .post('/api/favorites')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ destination: '일본 도쿄', activity: '아사쿠사 관광' })

    const response = await request(app)
      .delete(`/api/favorites/${created.body.favorite.id}`)
      .set('Authorization', `Bearer ${tokenB}`)

    expect(response.status).toBe(404)
  })
})
