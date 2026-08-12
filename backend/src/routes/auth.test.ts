// /api/auth 라우터(회원가입/로그인/내 정보/이메일·비밀번호 변경/탈퇴)를 supertest로 검증한다.
import request from 'supertest'
import { app } from '../app.js'

describe('GET /api/auth/check-email', () => {
  it('reports an unregistered email as available', async () => {
    const response = await request(app).get('/api/auth/check-email').query({ email: 'nobody@example.com' })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ available: true })
  })

  it('reports a registered email as unavailable', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'jini@example.com', password: 'password1' })

    const response = await request(app).get('/api/auth/check-email').query({ email: 'jini@example.com' })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ available: false })
  })

  it('rejects a request with no email', async () => {
    const response = await request(app).get('/api/auth/check-email')
    expect(response.status).toBe(400)
  })
})

describe('POST /api/auth/signup', () => {
  it('creates a new account and returns a token', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'jini@example.com', password: 'password1' })

    expect(response.status).toBe(201)
    expect(typeof response.body.token).toBe('string')
    expect(response.body.user).toEqual({ id: expect.any(String), email: 'jini@example.com' })
  })

  it('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'jini@example.com', password: 'password1' })

    const response = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'jini@example.com', password: 'anotherpassword' })

    expect(response.status).toBe(409)
  })

  it('rejects a signup missing a password', async () => {
    const response = await request(app).post('/api/auth/signup').send({ email: 'jini@example.com' })
    expect(response.status).toBe(400)
  })

  it('never returns the password hash', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'jini@example.com', password: 'password1' })

    expect(response.body.user.password_hash).toBeUndefined()
    expect(response.body.user.password).toBeUndefined()
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/signup').send({ email: 'jini@example.com', password: 'password1' })
  })

  it('logs in with the correct password and returns a token', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jini@example.com', password: 'password1' })

    expect(response.status).toBe(200)
    expect(typeof response.body.token).toBe('string')
    expect(response.body.user.email).toBe('jini@example.com')
  })

  // 이 두 테스트가 똑같이 401만 확인하고 서로 다른 에러 메시지를 요구하지 않는 이유: 라우트가
  // "이메일 없음"과 "비밀번호 틀림"을 의도적으로 구분하지 않는다 — 구분해서 응답하면 공격자가
  // 어떤 이메일이 가입되어 있는지 알아낼 수 있기 때문(계정 존재 여부 노출 방지).
  it('rejects an incorrect password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jini@example.com', password: 'wrongpassword' })

    expect(response.status).toBe(401)
  })

  it('rejects an unknown email', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password1' })

    expect(response.status).toBe(401)
  })
})

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid token', async () => {
    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'jini@example.com', password: 'password1' })

    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${signup.body.token}`)

    expect(response.status).toBe(200)
    expect(response.body.user).toEqual({ id: signup.body.user.id, email: 'jini@example.com' })
  })

  it('rejects a request with no token', async () => {
    const response = await request(app).get('/api/auth/me')
    expect(response.status).toBe(401)
  })

  it('rejects a request with an invalid token', async () => {
    const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token')
    expect(response.status).toBe(401)
  })
})

describe('PUT /api/auth/email', () => {
  it('requires a token', async () => {
    const response = await request(app).put('/api/auth/email').send({ email: 'new@example.com' })
    expect(response.status).toBe(401)
  })

  it('changes the email', async () => {
    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'jini@example.com', password: 'password1' })

    const response = await request(app)
      .put('/api/auth/email')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ email: 'new@example.com' })

    expect(response.status).toBe(200)
    expect(response.body.user).toEqual({ id: signup.body.user.id, email: 'new@example.com' })

    const login = await request(app).post('/api/auth/login').send({ email: 'new@example.com', password: 'password1' })
    expect(login.status).toBe(200)
  })

  it('rejects an email already used by another account', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'taken@example.com', password: 'password1' })
    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'jini@example.com', password: 'password1' })

    const response = await request(app)
      .put('/api/auth/email')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ email: 'taken@example.com' })

    expect(response.status).toBe(409)
  })
})

describe('PUT /api/auth/password', () => {
  it('requires a token', async () => {
    const response = await request(app)
      .put('/api/auth/password')
      .send({ currentPassword: 'password1', newPassword: 'newpassword1' })
    expect(response.status).toBe(401)
  })

  it('changes the password when the current password matches', async () => {
    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'jini@example.com', password: 'password1' })

    const response = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ currentPassword: 'password1', newPassword: 'newpassword1' })

    expect(response.status).toBe(200)

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jini@example.com', password: 'newpassword1' })
    expect(login.status).toBe(200)
  })

  it('rejects when the current password does not match', async () => {
    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'jini@example.com', password: 'password1' })

    const response = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword1' })

    expect(response.status).toBe(401)
  })
})

describe('DELETE /api/auth/me', () => {
  it('requires a token', async () => {
    const response = await request(app).delete('/api/auth/me')
    expect(response.status).toBe(401)
  })

  // 탈퇴 후 같은 이메일로 재가입이 되는지까지 확인 — users 행이 진짜로 지워졌고, 그에 딸린
  // trips/favorites/community_trips가 ON DELETE CASCADE로 함께 정리됐다는 걸 간접적으로 증명한다.
  it('deletes the account and frees up the email', async () => {
    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'jini@example.com', password: 'password1' })

    const response = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${signup.body.token}`)
    expect(response.status).toBe(204)

    const reSignup = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'jini@example.com', password: 'password2' })
    expect(reSignup.status).toBe(201)
  })
})
