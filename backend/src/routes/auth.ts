// 회원가입/로그인/계정 정보 관리. 이 라우터의 엔드포인트들만 인증 없이(또는 자기 자신에 대해서만)
// 호출 가능하고, 나머지 라우터(trips/favorites/community)는 여기서 발급한 JWT를 가져와 쓴다.
import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { pool } from '../db/pool.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { signToken } from '../lib/jwt.js'
import { verifyGoogleIdToken } from '../lib/googleAuth.js'
import { verifyKakaoAccessToken } from '../lib/kakaoAuth.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'

export const authRouter = Router()

// 가입 폼에서 이메일 칸을 벗어날 때(blur) 미리 중복 여부를 물어보기 위한 엔드포인트 —
// 실제 가입 처리(/signup)도 동일한 검사를 다시 하므로, 여기서 놓쳐도(레이스 컨디션 등)
// 최종적으로는 안전하다.
authRouter.get('/check-email', async (req, res) => {
  const email = req.query.email

  if (typeof email !== 'string' || !email.trim()) {
    res.status(400).json({ error: '이메일을 입력해주세요.' })
    return
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email])
  res.json({ available: existing.rows.length === 0 })
})

authRouter.post('/signup', async (req, res) => {
  const { email, password } = req.body ?? {}

  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' })
    return
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email])
  if (existing.rows.length > 0) {
    res.status(409).json({ error: '이미 가입된 이메일이에요.' })
    return
  }

  const id = randomUUID()
  const passwordHash = await hashPassword(password)
  await pool.query('INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)', [id, email, passwordHash])

  res.status(201).json({ token: signToken(id), user: { id, email, nickname: null } })
})

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' })
    return
  }

  const result = await pool.query('SELECT id, email, nickname, password_hash FROM users WHERE email = $1', [email])
  const user = result.rows[0]

  // 이메일이 없는 경우와 비밀번호가 틀린 경우를 같은 메시지·같은 상태코드로 응답한다 —
  // "가입된 이메일인지"를 외부에서 무차별로 알아낼 수 없게(계정 존재 여부 노출 방지) 하기 위해서다.
  if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않아요.' })
    return
  }

  res.json({ token: signToken(user.id), user: { id: user.id, email: user.email, nickname: user.nickname } })
})

// 프론트(Google Identity Services)가 로그인 성공 후 받은 id_token을 그대로 보내주면, 서버가
// 구글에 검증을 맡긴 뒤 그 결과(sub/email)로 계정을 찾거나 새로 만든다. 비밀번호는 관여하지 않는다.
authRouter.post('/oauth/google', async (req, res) => {
  const { idToken } = req.body ?? {}

  if (typeof idToken !== 'string' || !idToken) {
    res.status(400).json({ error: '구글 로그인 토큰이 없어요.' })
    return
  }

  const profile = await verifyGoogleIdToken(idToken)
  if (!profile) {
    res.status(401).json({ error: '구글 로그인을 확인하지 못했어요.' })
    return
  }

  const byProvider = await pool.query('SELECT id, email FROM users WHERE provider = $1 AND provider_id = $2', [
    'google',
    profile.sub,
  ])
  if (byProvider.rows.length > 0) {
    const user = byProvider.rows[0]
    // 닉네임은 최초 로그인 때 한 번만 구글 이름으로 채우고, 그 뒤로는 건드리지 않는다 —
    // 사용자가 /account에서 닉네임을 직접 바꿔놨는데 다음 로그인 때 구글 이름으로 도로
    // 덮어써버리면 "바꾼 게 안 바뀐 것처럼" 보이기 때문(COALESCE로 NULL일 때만 채움).
    const updated = await pool.query('UPDATE users SET nickname = COALESCE(nickname, $1) WHERE id = $2 RETURNING nickname', [
      profile.name,
      user.id,
    ])
    res.json({ token: signToken(user.id), user: { id: user.id, email: user.email, nickname: updated.rows[0].nickname } })
    return
  }

  // 같은 이메일로 이미 이메일/비밀번호 계정이 있으면, 새 계정을 또 만들지 않고 그 계정에
  // 구글 로그인을 연결한다 — 이후로는 둘 중 어느 방법으로 로그인해도 같은 계정으로 들어온다.
  const byEmail = await pool.query('SELECT id, email FROM users WHERE email = $1', [profile.email])
  if (byEmail.rows.length > 0) {
    const user = byEmail.rows[0]
    const updated = await pool.query(
      'UPDATE users SET provider = $1, provider_id = $2, nickname = COALESCE(nickname, $3) WHERE id = $4 RETURNING nickname',
      ['google', profile.sub, profile.name, user.id],
    )
    res.json({ token: signToken(user.id), user: { id: user.id, email: user.email, nickname: updated.rows[0].nickname } })
    return
  }

  const id = randomUUID()
  await pool.query('INSERT INTO users (id, email, provider, provider_id, nickname) VALUES ($1, $2, $3, $4, $5)', [
    id,
    profile.email,
    'google',
    profile.sub,
    profile.name,
  ])
  res.status(201).json({ token: signToken(id), user: { id, email: profile.email, nickname: profile.name } })
})

// 프론트(Kakao SDK)가 로그인 성공 후 받은 access_token을 그대로 보내주면, 서버가 카카오
// 사용자정보 API로 검증을 맡긴 뒤 그 결과(id/email)로 계정을 찾거나 새로 만든다. 카카오는
// 이메일 동의/인증 여부에 따라 이메일을 안 줄 수도 있어, 그 경우 provider_id 기반의 자리표시
// 이메일을 대신 채운다 — users.email이 NOT NULL이라서다. 실제 계정 식별은 항상 provider+
// provider_id로만 하므로 이 자리표시 값이 사용자에게 노출되거나 쓰일 일은 없다.
authRouter.post('/oauth/kakao', async (req, res) => {
  const { accessToken } = req.body ?? {}

  if (typeof accessToken !== 'string' || !accessToken) {
    res.status(400).json({ error: '카카오 로그인 토큰이 없어요.' })
    return
  }

  const profile = await verifyKakaoAccessToken(accessToken)
  if (!profile) {
    res.status(401).json({ error: '카카오 로그인을 확인하지 못했어요.' })
    return
  }

  const byProvider = await pool.query('SELECT id, email FROM users WHERE provider = $1 AND provider_id = $2', [
    'kakao',
    profile.id,
  ])
  if (byProvider.rows.length > 0) {
    const user = byProvider.rows[0]
    // 닉네임은 최초 로그인 때 한 번만 카카오 닉네임으로 채우고, 그 뒤로는 건드리지 않는다 —
    // 사용자가 /account에서 닉네임을 직접 바꿔놨는데 다음 로그인 때 카카오 닉네임으로 도로
    // 덮어써버리면 "바꾼 게 안 바뀐 것처럼" 보이기 때문(COALESCE로 NULL일 때만 채움).
    const updated = await pool.query('UPDATE users SET nickname = COALESCE(nickname, $1) WHERE id = $2 RETURNING nickname', [
      profile.nickname,
      user.id,
    ])
    res.json({ token: signToken(user.id), user: { id: user.id, email: user.email, nickname: updated.rows[0].nickname } })
    return
  }

  // 같은 이메일로 이미 이메일/비밀번호 계정이 있으면(카카오가 실제 이메일을 준 경우에 한해),
  // 새 계정을 또 만들지 않고 그 계정에 카카오 로그인을 연결한다.
  if (profile.email) {
    const byEmail = await pool.query('SELECT id, email FROM users WHERE email = $1', [profile.email])
    if (byEmail.rows.length > 0) {
      const user = byEmail.rows[0]
      const updated = await pool.query(
        'UPDATE users SET provider = $1, provider_id = $2, nickname = COALESCE(nickname, $3) WHERE id = $4 RETURNING nickname',
        ['kakao', profile.id, profile.nickname, user.id],
      )
      res.json({ token: signToken(user.id), user: { id: user.id, email: user.email, nickname: updated.rows[0].nickname } })
      return
    }
  }

  const id = randomUUID()
  const email = profile.email ?? `kakao-${profile.id}@kakaouser.trippilot.invalid`
  await pool.query('INSERT INTO users (id, email, provider, provider_id, nickname) VALUES ($1, $2, $3, $4, $5)', [
    id,
    email,
    'kakao',
    profile.id,
    profile.nickname,
  ])
  res.status(201).json({ token: signToken(id), user: { id, email, nickname: profile.nickname } })
})

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const result = await pool.query('SELECT id, email, nickname FROM users WHERE id = $1', [req.userId])
  const user = result.rows[0]

  if (!user) {
    res.status(404).json({ error: '사용자를 찾을 수 없어요.' })
    return
  }

  res.json({ user })
})

// 화면(헤더/커뮤니티)에 표시되는 이름을 이메일과 분리해서 직접 정할 수 있게 해준다. 이메일과
// 달리 중복 검사가 필요 없다(닉네임은 유일할 필요가 없음). 한번 설정해두면 이후 구글/카카오
// 로그인이 다시 덮어쓰지 않는다(oauth 라우트의 COALESCE 참고).
authRouter.put('/nickname', requireAuth, async (req: AuthedRequest, res) => {
  const { nickname } = req.body ?? {}

  if (typeof nickname !== 'string' || !nickname.trim()) {
    res.status(400).json({ error: '닉네임을 입력해주세요.' })
    return
  }

  const result = await pool.query('UPDATE users SET nickname = $1 WHERE id = $2 RETURNING id, email, nickname', [
    nickname.trim(),
    req.userId,
  ])

  res.json({ user: result.rows[0] })
})

authRouter.put('/password', requireAuth, async (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body ?? {}

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !newPassword) {
    res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' })
    return
  }

  const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId])
  const passwordHash = result.rows[0]?.password_hash

  if (!passwordHash || !(await verifyPassword(currentPassword, passwordHash))) {
    res.status(401).json({ error: '현재 비밀번호가 올바르지 않아요.' })
    return
  }

  const nextHash = await hashPassword(newPassword)
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [nextHash, req.userId])

  res.json({ success: true })
})

// 여기서 trips/favorites/community_trips를 따로 지우지 않는다 — schema.sql의
// ON DELETE CASCADE가 users 삭제 시 연관 데이터를 전부 함께 지워준다.
authRouter.delete('/me', requireAuth, async (req: AuthedRequest, res) => {
  await pool.query('DELETE FROM users WHERE id = $1', [req.userId])
  res.status(204).end()
})
