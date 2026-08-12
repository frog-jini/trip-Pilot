// 즐겨찾기(찜한 장소) CRUD. 목록/추가/삭제 전부 본인 소유(user_id)로만 동작하며,
// destinationSearchPage·TripDetailPage·TripPlanForm(자동 병합) 등 여러 화면에서 공유해서 쓴다.
import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'

export const favoritesRouter = Router()
// 이 라우터 전체가 로그인 필요 — 비로그인 사용자는 즐겨찾기 자체가 없다.
favoritesRouter.use(requireAuth)

favoritesRouter.get('/', async (req: AuthedRequest, res) => {
  const result = await pool.query('SELECT id, destination, activity FROM favorites WHERE user_id = $1', [
    req.userId,
  ])
  res.json({ favorites: result.rows })
})

favoritesRouter.post('/', async (req: AuthedRequest, res) => {
  const { destination, activity } = req.body ?? {}

  if (typeof destination !== 'string' || !destination || typeof activity !== 'string' || !activity) {
    res.status(400).json({ error: 'destination과 activity가 필요해요.' })
    return
  }

  // 이미 즐겨찾기한 장소를 다시 추가해도 에러 대신 조용히 무시한다(schema.sql의 UNIQUE
  // (user_id, destination, activity) 제약과 짝을 이룸) — 그래서 아래에서 randomUUID()로 만든
  // id가 실제로는 안 쓰였을 수도 있고, 바로 아래 SELECT로 "진짜 저장된" 행을 다시 읽어온다.
  await pool.query(
    `INSERT INTO favorites (id, user_id, destination, activity)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, destination, activity) DO NOTHING`,
    [randomUUID(), req.userId, destination, activity],
  )

  const result = await pool.query(
    'SELECT id, destination, activity FROM favorites WHERE user_id = $1 AND destination = $2 AND activity = $3',
    [req.userId, destination, activity],
  )
  res.status(201).json({ favorite: result.rows[0] })
})

favoritesRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const result = await pool.query('DELETE FROM favorites WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.userId,
  ])

  if (result.rowCount === 0) {
    res.status(404).json({ error: '즐겨찾기를 찾을 수 없어요.' })
    return
  }

  res.status(204).end()
})
