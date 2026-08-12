import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { pool } from './pool.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// schema.sql은 CREATE TABLE IF NOT EXISTS / ALTER TABLE ... ADD COLUMN IF NOT EXISTS로만
// 구성되어 있어 몇 번을 다시 실행해도 안전하다(멱등) — 그래서 별도의 마이그레이션 버전 관리
// 없이 파일 전체를 그대로 재실행하는 방식으로 충분하다.
export async function migrate(): Promise<void> {
  const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8')
  await pool.query(schema)
}

// `tsx src/db/migrate.ts`처럼 직접 실행됐을 때만 동작하고, 다른 모듈(test/setup.ts 등)에서
// import해서 쓸 때는 이 블록이 실행되지 않는다.
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => {
      console.log('Migration complete')
      return pool.end()
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
