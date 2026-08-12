// 앱 전역에서 공유하는 단일 pg Pool. 모든 라우트/스크립트가 이 pool을 import해서 쓴다.
// 실제로 어떤 DB에 붙는지는 resolveConnectionString()이 NODE_ENV에 따라 결정한다
// (테스트 중이면 자동으로 별도의 _test DB로 분리됨).
import { Pool } from 'pg'
import { resolveConnectionString } from './connectionString.js'

export const pool = new Pool({
  connectionString: resolveConnectionString(process.env),
})
