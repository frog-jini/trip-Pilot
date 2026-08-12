// 회원가입/로그인/계정 정보 관리. 이 라우터의 엔드포인트들만 인증 없이(또는 자기 자신에 대해서만)
// 호출 가능하고, 나머지 라우터(trips/favorites/community)는 여기서 발급한 JWT를 가져와 쓴다.
import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { pool } from '../db/pool.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { signToken } from '../lib/jwt.js'
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

  res.status(201).json({ token: signToken(id), user: { id, email } })
})

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' })
    return
  }

  const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email])
  const user = result.rows[0]

  // 이메일이 없는 경우와 비밀번호가 틀린 경우를 같은 메시지·같은 상태코드로 응답한다 —
  // "가입된 이메일인지"를 외부에서 무차별로 알아낼 수 없게(계정 존재 여부 노출 방지) 하기 위해서다.
  if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않아요.' })
    return
  }

  res.json({ token: signToken(user.id), user: { id: user.id, email: user.email } })
})

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const result = await pool.query('SELECT id, email FROM users WHERE id = $1', [req.userId])
  const user = result.rows[0]

  if (!user) {
    res.status(404).json({ error: '사용자를 찾을 수 없어요.' })
    return
  }

  res.json({ user })
})

authRouter.put('/email', requireAuth, async (req: AuthedRequest, res) => {
  const { email } = req.body ?? {}

  if (typeof email !== 'string' || !email.trim()) {
    res.status(400).json({ error: '이메일을 입력해주세요.' })
    return
  }

  // id != $2로 자기 자신은 제외하고 검사한다 — 안 그러면 "지금 이메일 그대로 다시 저장"도
  // 중복으로 걸려버린다.
  const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.userId])
  if (existing.rows.length > 0) {
    res.status(409).json({ error: '이미 사용 중인 이메일이에요.' })
    return
  }

  const result = await pool.query('UPDATE users SET email = $1 WHERE id = $2 RETURNING id, email', [
    email,
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
