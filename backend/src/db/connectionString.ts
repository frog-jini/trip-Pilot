export interface ConnectionStringEnv {
  NODE_ENV?: string
  DATABASE_URL?: string
  TEST_DATABASE_URL?: string
}

// 테스트는 실행 중인 앱/프론트엔드가 쓰는 DB를 절대 건드리면 안 된다 — vitest의 beforeEach가
// 모든 테이블을 TRUNCATE하기 때문에, 개발/운영과 같은 접속 주소를 쓰면 테스트를 돌릴 때마다
// 실제 사용자 데이터가 지워진다. 그래서 대신 분리된 "<db>_test" DB 주소를 만들어 쓴다.
export function resolveConnectionString(env: ConnectionStringEnv): string {
  if (env.NODE_ENV !== 'test') {
    if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
    return env.DATABASE_URL
  }

  if (env.TEST_DATABASE_URL) return env.TEST_DATABASE_URL

  if (!env.DATABASE_URL) return 'postgres://trippilot:trippilot@localhost:5432/trippilot_test'

  const url = new URL(env.DATABASE_URL)
  url.pathname = `${url.pathname}_test`
  return url.toString()
}
