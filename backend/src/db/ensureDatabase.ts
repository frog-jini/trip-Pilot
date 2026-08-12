// resolveConnectionString()이 만들어낸 "<db>_test" 이름의 DB가 아직 없으면 만들어준다.
// 테스트 스위트를 처음 돌리는 사람이 수동으로 CREATE DATABASE를 미리 해둘 필요가 없게 하기 위함.
import { Pool } from 'pg'

export async function ensureDatabaseExists(connectionString: string): Promise<void> {
  const target = new URL(connectionString)
  const dbName = target.pathname.replace(/^\//, '')

  // CREATE DATABASE는 대상 DB에 접속한 채로는 실행할 수 없어서, 항상 존재하는 postgres
  // 기본 DB에 별도로 접속해 "관리자" 역할로 실행한다.
  const adminUrl = new URL(connectionString)
  adminUrl.pathname = '/postgres'

  const adminPool = new Pool({ connectionString: adminUrl.toString() })
  try {
    const existing = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
    if (existing.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE "${dbName}"`)
    }
  } finally {
    await adminPool.end()
  }
}
