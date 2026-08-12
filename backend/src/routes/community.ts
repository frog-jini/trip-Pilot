// 커뮤니티(다른 사용자의 공유 일정) 라우터. 목록/상세/조회수 증가는 비로그인도 가능하고,
// 공유(등록)·수정·삭제·좋아요는 로그인 + 본인 게시글에 대해서만 가능하다.
import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth, optionalAuth, type AuthedRequest } from '../middleware/auth.js'

export const communityRouter = Router()

// seed_likes(데모 게시글의 기본 좋아요 수) + 실제 사용자가 누른 좋아요 수를 더해서 노출한다 —
// 그래야 데모 데이터도 실제 좋아요처럼 정렬/표시에 자연스럽게 섞인다.
const LIST_COLUMNS = `
  ct.id, ct.author, ct.tag, ct.itinerary, ct.created_at AS "createdAt",
  COALESCE(cv.view_count, 0) AS views,
  ct.seed_likes + (SELECT COUNT(*)::int FROM community_trip_likes WHERE community_trip_id = ct.id) AS likes
`

async function fetchCommunityTrip(id: string, userId?: string) {
  const result = await pool.query(
    `SELECT ${LIST_COLUMNS},
       EXISTS (
         SELECT 1 FROM community_trip_likes WHERE community_trip_id = ct.id AND user_id = $2
       ) AS liked
     FROM community_trips ct
     LEFT JOIN community_trip_views cv ON cv.community_trip_id = ct.id
     WHERE ct.id = $1`,
    [id, userId ?? null],
  )
  return result.rows[0] ?? null
}

communityRouter.get('/', optionalAuth, async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT ${LIST_COLUMNS},
       EXISTS (
         SELECT 1 FROM community_trip_likes WHERE community_trip_id = ct.id AND user_id = $1
       ) AS liked
     FROM community_trips ct
     LEFT JOIN community_trip_views cv ON cv.community_trip_id = ct.id
     ORDER BY likes DESC, ct.created_at DESC`,
    [req.userId ?? null],
  )
  res.json({ trips: result.rows })
})

communityRouter.get('/mine/:tripId', requireAuth, async (req: AuthedRequest, res) => {
  const result = await pool.query(
    'SELECT id FROM community_trips WHERE source_trip_id = $1 AND user_id = $2',
    [req.params.tripId, req.userId],
  )
  const row = result.rows[0]

  if (!row) {
    res.json({ trip: null })
    return
  }

  res.json({ trip: await fetchCommunityTrip(row.id, req.userId) })
})

communityRouter.get('/:id', optionalAuth, async (req: AuthedRequest, res) => {
  const trip = await fetchCommunityTrip(req.params.id as string, req.userId)

  if (!trip) {
    res.status(404).json({ error: '커뮤니티 일정을 찾을 수 없어요.' })
    return
  }

  res.json({ trip })
})

communityRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const { tripId, tag } = req.body ?? {}

  if (typeof tripId !== 'string' || !tripId || typeof tag !== 'string' || !tag) {
    res.status(400).json({ error: 'tripId와 tag가 필요해요.' })
    return
  }

  const tripResult = await pool.query('SELECT id, itinerary FROM trips WHERE id = $1 AND user_id = $2', [
    tripId,
    req.userId,
  ])
  const sourceTrip = tripResult.rows[0]
  if (!sourceTrip) {
    res.status(404).json({ error: '일정을 찾을 수 없어요.' })
    return
  }

  // schema.sql의 UNIQUE(source_trip_id) 제약과 짝을 이룬다 — 이미 공유된 일정을 다시
  // "공유하기" 눌러도 에러 대신 기존 게시글을 그대로 돌려준다(멱등).
  const existing = await pool.query('SELECT id FROM community_trips WHERE source_trip_id = $1', [tripId])
  if (existing.rows[0]) {
    res.status(201).json({ trip: await fetchCommunityTrip(existing.rows[0].id, req.userId) })
    return
  }

  const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId])
  const author = userResult.rows[0]?.email ?? '익명 여행자'

  const id = randomUUID()
  await pool.query(
    `INSERT INTO community_trips (id, user_id, source_trip_id, author, tag, itinerary)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, req.userId, tripId, author, tag, sourceTrip.itinerary],
  )

  res.status(201).json({ trip: await fetchCommunityTrip(id, req.userId) })
})

communityRouter.put('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const { tag } = req.body ?? {}

  if (typeof tag !== 'string' || !tag) {
    res.status(400).json({ error: 'tag가 필요해요.' })
    return
  }

  const existing = await pool.query(
    'SELECT id, source_trip_id FROM community_trips WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId],
  )
  const communityTrip = existing.rows[0]
  if (!communityTrip) {
    res.status(404).json({ error: '커뮤니티 일정을 찾을 수 없어요.' })
    return
  }

  // Re-sync from the source trip so edits made after publishing (add a day, swap an
  // activity, ...) show up on the community post too. If the source trip was deleted,
  // source_trip_id is null (ON DELETE SET NULL) and we just leave the itinerary as-is.
  if (communityTrip.source_trip_id) {
    const tripResult = await pool.query('SELECT itinerary FROM trips WHERE id = $1 AND user_id = $2', [
      communityTrip.source_trip_id,
      req.userId,
    ])
    const itinerary = tripResult.rows[0]?.itinerary
    if (itinerary !== undefined) {
      await pool.query('UPDATE community_trips SET tag = $1, itinerary = $2 WHERE id = $3', [
        tag,
        itinerary,
        req.params.id,
      ])
    } else {
      await pool.query('UPDATE community_trips SET tag = $1 WHERE id = $2', [tag, req.params.id])
    }
  } else {
    await pool.query('UPDATE community_trips SET tag = $1 WHERE id = $2', [tag, req.params.id])
  }

  res.json({ trip: await fetchCommunityTrip(req.params.id as string, req.userId) })
})

communityRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const result = await pool.query('DELETE FROM community_trips WHERE id = $1 AND user_id = $2 RETURNING id', [
    req.params.id,
    req.userId,
  ])

  if (result.rowCount === 0) {
    res.status(404).json({ error: '커뮤니티 일정을 찾을 수 없어요.' })
    return
  }

  // community_trip_likes/views는 community_trip_id를 FK가 아닌 평범한 텍스트로만 참조하도록
  // 설계되어 있어서(schema.sql 주석 참고, 시드 데이터 지원 목적) DB가 자동으로 정리해주지
  // 않는다 — 그래서 여기서 애플리케이션 레벨로 직접 지워준다.
  await pool.query('DELETE FROM community_trip_likes WHERE community_trip_id = $1', [req.params.id])
  await pool.query('DELETE FROM community_trip_views WHERE community_trip_id = $1', [req.params.id])

  res.status(204).end()
})

// 좋아요 상태를 저장해두지 않고, 매번 "행이 있으면 지우고 없으면 만든다"로 토글한다 —
// 클라이언트는 지금 좋아요 상태를 몰라도 그냥 이 엔드포인트만 호출하면 된다.
communityRouter.post('/:id/like', requireAuth, async (req: AuthedRequest, res) => {
  const existing = await pool.query(
    'SELECT 1 FROM community_trip_likes WHERE user_id = $1 AND community_trip_id = $2',
    [req.userId, req.params.id],
  )

  if (existing.rows.length > 0) {
    await pool.query('DELETE FROM community_trip_likes WHERE user_id = $1 AND community_trip_id = $2', [
      req.userId,
      req.params.id,
    ])
  } else {
    await pool.query('INSERT INTO community_trip_likes (user_id, community_trip_id) VALUES ($1, $2)', [
      req.userId,
      req.params.id,
    ])
  }

  const trip = await fetchCommunityTrip(req.params.id as string, req.userId)
  if (!trip) {
    res.status(404).json({ error: '커뮤니티 일정을 찾을 수 없어요.' })
    return
  }

  res.json({ trip })
})

// 인증 미들웨어가 아예 없다 — 조회수는 누구나(비로그인 포함) 올릴 수 있어야 한다.
// INSERT ... ON CONFLICT DO UPDATE로 "없으면 1, 있으면 +1"을 한 번의 쿼리로 원자적으로 처리해서
// 동시 요청이 와도 조회수가 누락되지 않는다.
communityRouter.post('/:id/view', async (req, res) => {
  await pool.query(
    `INSERT INTO community_trip_views (community_trip_id, view_count)
     VALUES ($1, 1)
     ON CONFLICT (community_trip_id) DO UPDATE SET view_count = community_trip_views.view_count + 1`,
    [req.params.id],
  )

  const result = await pool.query('SELECT view_count FROM community_trip_views WHERE community_trip_id = $1', [
    req.params.id,
  ])
  res.json({ views: result.rows[0]?.view_count ?? 0 })
})
