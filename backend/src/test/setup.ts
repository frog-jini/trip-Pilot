// vitest.config.ts의 setupFiles로 모든 테스트 실행 전에 자동으로 로드된다.
// ⚠ 아래 beforeEach가 모든 테이블을 TRUNCATE한다 — pool이 실제 개발 DB에 연결되어 있었다면
// 매 테스트마다 실사용 데이터가 통째로 지워진다. 그래서 vitest.config.ts가 NODE_ENV=test를
// 강제하고, pool.ts가 resolveConnectionString()을 통해 자동으로 별도의 "<db>_test" DB에
// 붙도록 되어 있다 — 이 분리가 깨지면 다시 데이터 소실 사고가 난다.
import { migrate } from '../db/migrate.js'
import { pool } from '../db/pool.js'
import { ensureDatabaseExists } from '../db/ensureDatabase.js'
import { resolveConnectionString } from '../db/connectionString.js'

beforeAll(async () => {
  // 테스트 DB가 아직 없으면 만들고(최초 1회), 최신 스키마로 맞춘다.
  await ensureDatabaseExists(resolveConnectionString(process.env))
  await migrate()
})

// 테스트끼리 서로 데이터가 섞이지 않도록 매 테스트 전에 전부 비운다 — RESTART IDENTITY까지
// 줘서 시퀀스도 초기화하므로, 각 테스트는 항상 빈 DB에서 시작한다고 가정할 수 있다.
beforeEach(async () => {
  await pool.query(
    'TRUNCATE TABLE community_trip_likes, community_trip_views, community_trips, favorites, trips, users RESTART IDENTITY CASCADE',
  )
})

afterAll(async () => {
  await pool.end()
})
