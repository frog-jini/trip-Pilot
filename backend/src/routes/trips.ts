// 로그인한 사용자의 "내 일정" CRUD. community.ts는 이 테이블의 트립을 공유 시점에 스냅샷으로
// 복사해가므로, 여기서 일정을 삭제해도 이미 공유된 커뮤니티 게시글은 남는다(source_trip_id만 SET NULL).
import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'

export const tripsRouter = Router()
// 이 라우터의 모든 엔드포인트는 로그인(JWT)이 필요하다 — 아래 각 핸들러에서 req.userId를 그대로 신뢰한다.
tripsRouter.use(requireAuth)

const TRIP_COLUMNS = 'id, itinerary, form_values AS "formValues", history, costs, times, created_at AS "createdAt"'

// 내 일정 목록 — 최신순으로 정렬해 돌려준다.
tripsRouter.get('/', async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT ${TRIP_COLUMNS} FROM trips WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.userId],
  )
  res.json({ trips: result.rows })
})

// 새 일정 생성. costs·times는 처음엔 항상 비어 있고(스키마 DEFAULT '{}'),
// 이후 PUT으로만 채워진다 — 생성 시점엔 아직 비용/시간을 조정할 활동이 없기 때문.
tripsRouter.post('/', async (req: AuthedRequest, res) => {
  const { itinerary, formValues, history } = req.body ?? {}

  if (!itinerary || !formValues) {
    res.status(400).json({ error: 'itinerary와 formValues가 필요해요.' })
    return
  }

  const id = randomUUID()
  await pool.query(
    'INSERT INTO trips (id, user_id, itinerary, form_values, history) VALUES ($1, $2, $3, $4, $5)',
    [id, req.userId, itinerary, formValues, history ?? {}],
  )

  const result = await pool.query(`SELECT ${TRIP_COLUMNS} FROM trips WHERE id = $1`, [id])
  res.status(201).json({ trip: result.rows[0] })
})

// 일정 상세 조회. user_id가 다르면 그냥 404를 돌려줘서 존재 여부 자체를 숨긴다.
tripsRouter.get('/:id', async (req: AuthedRequest, res) => {
  const result = await pool.query(`SELECT ${TRIP_COLUMNS} FROM trips WHERE id = $1 AND user_id = $2`, [
    req.params.id,
    req.userId,
  ])
  const trip = result.rows[0]

  if (!trip) {
    res.status(404).json({ error: '일정을 찾을 수 없어요.' })
    return
  }

  res.json({ trip })
})

// 일정 수정. itinerary는 필수지만 history·costs·times는 생략 가능 — 다만 생략하면
// 그 컬럼은 빈 값으로 덮어써진다. 그래서 프론트(TripDetailPage)는 activities만 바뀌는
// 수정에서도 반드시 현재 costs·times를 함께 실어 보내야 기존 값이 사라지지 않는다.
tripsRouter.put('/:id', async (req: AuthedRequest, res) => {
  const { itinerary, history, costs, times } = req.body ?? {}

  if (!itinerary) {
    res.status(400).json({ error: 'itinerary가 필요해요.' })
    return
  }

  const result = await pool.query(
    `UPDATE trips SET itinerary = $1, history = $2, costs = $3, times = $4
     WHERE id = $5 AND user_id = $6
     RETURNING ${TRIP_COLUMNS}`,
    [itinerary, history ?? {}, costs ?? {}, times ?? {}, req.params.id, req.userId],
  )
  const trip = result.rows[0]

  if (!trip) {
    res.status(404).json({ error: '일정을 찾을 수 없어요.' })
    return
  }

  res.json({ trip })
})

// user_id 조건까지 함께 거는 것으로 소유권 검사와 삭제를 한 쿼리로 끝낸다 — rowCount가 0이면
// "존재하지 않음"과 "남의 일정임"을 구분하지 않고 똑같이 404로 응답한다.
tripsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const result = await pool.query('DELETE FROM trips WHERE id = $1 AND user_id = $2', [req.params.id, req.userId])

  if (result.rowCount === 0) {
    res.status(404).json({ error: '일정을 찾을 수 없어요.' })
    return
  }

  res.status(204).end()
})
