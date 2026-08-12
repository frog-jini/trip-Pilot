export interface ConnectionStringEnv {
  NODE_ENV?: string
  DATABASE_URL?: string
  TEST_DATABASE_URL?: string
}

// Tests must never touch the same database the running app/frontend uses — vitest's
// beforeEach TRUNCATEs every table, so sharing a connection string with dev/prod wipes
// real user data on every test run. This derives an isolated "<db>_test" database instead.
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
