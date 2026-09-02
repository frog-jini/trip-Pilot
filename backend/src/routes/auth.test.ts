// /api/auth 라우터(회원가입/로그인/내 정보/이메일·비밀번호 변경/탈퇴)를 supertest로 검증한다.
import request from 'supertest'
import { app } from '../app.js'

// 실제 구글 서버에 검증을 보내지 않도록 google-auth-library를 모킹한다. idToken을
// "sub|email|name"(name은 생략 가능) 형식의 가짜 값으로 넘기면 그대로 페이로드처럼 돌려주고,
// 'invalid-token'을 넘기면 검증 실패(예외)를 흉내낸다.
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: vi.fn(async ({ idToken }: { idToken: string }) => {
      if (idToken === 'invalid-token') throw new Error('invalid token')
      const [sub, email, name] = idToken.split('|')
      return { getPayload: () => ({ sub, email, name }) }
    }),
  })),
}))

// 실제 카카오 서버에 검증을 보내지 않도록 전역 fetch를 모킹한다. accessToken을 "id|email|nickname"
// (email/nickname은 생략 가능) 형식의 가짜 값으로 넘기면 카카오 사용자정보 API 응답 형태로
// 흉내내고, 'invalid-kakao-token'을 넘기면 카카오가 401을 돌려주는 상황을 흉내낸다.
const realFetch = global.fetch

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url) !== 'https://kapi.kakao.com/v2/user/me') return realFetch(url, init)

      const authHeader = (init?.headers as Record<string, string> | undefined)?.Authorization ?? ''
      const accessToken = authHeader.replace('Bearer ', '')
      if (accessToken === 'invalid-kakao-token') {
        return new Response(null, { status: 401 })
      }

      const [id, email, nickname] = accessToken.split('|')
      return new Response(
        JSON.stringify({
          id: Number(id),
          kakao_account: email ? { email, is_email_verified: true } : {},
          properties: nickname ? { nickname } : {},
        }),
        { status: 200 },
      )
    }),
  )
})

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
    expect(response.body.user).toEqual({ id: expect.any(String), email: 'jini@example.com', nickname: null })
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
    expect(response.body.user).toEqual({ id: signup.body.user.id, email: 'jini@example.com', nickname: null })
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

// 가입 시 쓴 이메일은 계정 식별자로 고정이고, 화면에 보이는 이름은 대신 닉네임(PUT
// /api/auth/nickname)으로 바꾸게 되어 있다 — 이메일 변경 엔드포인트는 의도적으로 없다.
describe('PUT /api/auth/email', () => {
  it('does not exist — email is fixed once an account is created', async () => {
    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'jini@example.com', password: 'password1' })

    const response = await request(app)
      .put('/api/auth/email')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ email: 'new@example.com' })

    expect(response.status).toBe(404)
  })
})

describe('PUT /api/auth/nickname', () => {
  it('requires a token', async () => {
    const response = await request(app).put('/api/auth/nickname').send({ nickname: '개굴' })
    expect(response.status).toBe(401)
  })

  it('sets the nickname, independently of email', async () => {
    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'jini@example.com', password: 'password1' })

    const response = await request(app)
      .put('/api/auth/nickname')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ nickname: '개굴' })

    expect(response.status).toBe(200)
    expect(response.body.user).toEqual({ id: signup.body.user.id, email: 'jini@example.com', nickname: '개굴' })
  })

  it('rejects an empty nickname', async () => {
    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'jini@example.com', password: 'password1' })

    const response = await request(app)
      .put('/api/auth/nickname')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ nickname: '   ' })

    expect(response.status).toBe(400)
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

describe('POST /api/auth/oauth/google', () => {
  it('creates a new account on first-ever google login', async () => {
    const response = await request(app)
      .post('/api/auth/oauth/google')
      .send({ idToken: 'google-sub-1|new@example.com' })

    expect(response.status).toBe(201)
    expect(typeof response.body.token).toBe('string')
    expect(response.body.user).toEqual({ id: expect.any(String), email: 'new@example.com', nickname: null })
  })

  it('stores the google display name as the nickname on first login', async () => {
    const response = await request(app)
      .post('/api/auth/oauth/google')
      .send({ idToken: 'google-sub-9|nick@example.com|철수' })
    expect(response.body.user.nickname).toBe('철수')
  })

  // 사용자가 /account에서 닉네임을 직접 바꿔둔 뒤 다시 구글로 로그인해도, 구글이 주는 이름으로
  // 도로 덮어쓰이면 안 된다 — 한 번 채워지면 그 뒤로는 로그인 때마다 갱신하지 않는다.
  it('does not overwrite an already-set nickname on repeat google logins', async () => {
    const first = await request(app)
      .post('/api/auth/oauth/google')
      .send({ idToken: 'google-sub-9|nick@example.com|철수' })
    expect(first.body.user.nickname).toBe('철수')

    const second = await request(app)
      .post('/api/auth/oauth/google')
      .send({ idToken: 'google-sub-9|nick@example.com|철수2' })
    expect(second.status).toBe(200)
    expect(second.body.user.id).toBe(first.body.user.id)
    expect(second.body.user.nickname).toBe('철수')

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${second.body.token}`)
    expect(me.body.user.nickname).toBe('철수')
  })

  it('logs back into the same account on a repeat google login', async () => {
    const first = await request(app)
      .post('/api/auth/oauth/google')
      .send({ idToken: 'google-sub-1|repeat@example.com' })

    const second = await request(app)
      .post('/api/auth/oauth/google')
      .send({ idToken: 'google-sub-1|repeat@example.com' })

    expect(second.status).toBe(200)
    expect(second.body.user.id).toBe(first.body.user.id)
  })

  it('links google login to an existing email/password account instead of creating a duplicate', async () => {
    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'existing@example.com', password: 'password1' })

    const response = await request(app)
      .post('/api/auth/oauth/google')
      .send({ idToken: 'google-sub-2|existing@example.com' })

    expect(response.status).toBe(200)
    expect(response.body.user.id).toBe(signup.body.user.id)
  })

  it('rejects a token that fails google verification', async () => {
    const response = await request(app).post('/api/auth/oauth/google').send({ idToken: 'invalid-token' })
    expect(response.status).toBe(401)
  })

  it('rejects a request with no token', async () => {
    const response = await request(app).post('/api/auth/oauth/google').send({})
    expect(response.status).toBe(400)
  })
})

describe('POST /api/auth/oauth/kakao', () => {
  it('creates a new account on first-ever kakao login', async () => {
    const response = await request(app).post('/api/auth/oauth/kakao').send({ accessToken: '101|new@example.com' })

    expect(response.status).toBe(201)
    expect(typeof response.body.token).toBe('string')
    expect(response.body.user).toEqual({ id: expect.any(String), email: 'new@example.com', nickname: null })
  })

  it('stores the kakao nickname on first login', async () => {
    const response = await request(app).post('/api/auth/oauth/kakao').send({ accessToken: '109|nick@example.com|영희' })
    expect(response.body.user.nickname).toBe('영희')
  })

  // 구글과 동일한 규칙 — 한 번 채워진 닉네임은 카카오 재로그인으로 덮어써지지 않는다.
  it('does not overwrite an already-set nickname on repeat kakao logins', async () => {
    const first = await request(app).post('/api/auth/oauth/kakao').send({ accessToken: '109|nick@example.com|영희' })
    expect(first.body.user.nickname).toBe('영희')

    const second = await request(app)
      .post('/api/auth/oauth/kakao')
      .send({ accessToken: '109|nick@example.com|영희2' })
    expect(second.status).toBe(200)
    expect(second.body.user.id).toBe(first.body.user.id)
    expect(second.body.user.nickname).toBe('영희')
  })

  it('logs back into the same account on a repeat kakao login', async () => {
    const first = await request(app).post('/api/auth/oauth/kakao').send({ accessToken: '101|repeat@example.com' })
    const second = await request(app).post('/api/auth/oauth/kakao').send({ accessToken: '101|repeat@example.com' })

    expect(second.status).toBe(200)
    expect(second.body.user.id).toBe(first.body.user.id)
  })

  it('links kakao login to an existing email/password account instead of creating a duplicate', async () => {
    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'existing@example.com', password: 'password1' })

    const response = await request(app)
      .post('/api/auth/oauth/kakao')
      .send({ accessToken: '102|existing@example.com' })

    expect(response.status).toBe(200)
    expect(response.body.user.id).toBe(signup.body.user.id)
  })

  // 카카오가 이메일 동의를 안 받았거나 미인증 계정인 경우 이메일 없이 id만 준다 — 그래도
  // 계정은 정상적으로 만들어지고(자리표시 이메일), provider_id로 다음에도 같은 계정을 찾는다.
  it('creates an account even when kakao does not provide an email', async () => {
    const response = await request(app).post('/api/auth/oauth/kakao').send({ accessToken: '103' })

    expect(response.status).toBe(201)
    expect(response.body.user.email).toContain('103')

    const second = await request(app).post('/api/auth/oauth/kakao').send({ accessToken: '103' })
    expect(second.status).toBe(200)
    expect(second.body.user.id).toBe(response.body.user.id)
  })

  it('rejects a token that fails kakao verification', async () => {
    const response = await request(app).post('/api/auth/oauth/kakao').send({ accessToken: 'invalid-kakao-token' })
    expect(response.status).toBe(401)
  })

  it('rejects a request with no token', async () => {
    const response = await request(app).post('/api/auth/oauth/kakao').send({})
    expect(response.status).toBe(400)
  })
})
