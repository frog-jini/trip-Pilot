// resolveConnectionString()이 운영/테스트 DB를 절대 혼동하지 않는지 검증한다 — 과거에 테스트가
// 실제 개발 DB를 TRUNCATE해버린 사고가 있었어서(test/setup.ts 참고), 이 분리 로직 자체가
// 회귀하지 않도록 촘촘하게 테스트해둔다.
import { describe, expect, it } from 'vitest'
import { resolveConnectionString } from './connectionString.js'

describe('resolveConnectionString', () => {
  it('uses DATABASE_URL as-is outside of test mode', () => {
    const result = resolveConnectionString({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://trippilot:trippilot@db:5432/trippilot',
    })
    expect(result).toBe('postgres://trippilot:trippilot@db:5432/trippilot')
  })

  it('throws outside test mode when DATABASE_URL is missing', () => {
    expect(() => resolveConnectionString({ NODE_ENV: 'development' })).toThrow()
  })

  it('derives an isolated "_test" database from DATABASE_URL in test mode', () => {
    const result = resolveConnectionString({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://trippilot:trippilot@db:5432/trippilot',
    })
    expect(result).toBe('postgres://trippilot:trippilot@db:5432/trippilot_test')
  })

  it('never resolves to the same database name as DATABASE_URL in test mode', () => {
    const devUrl = 'postgres://trippilot:trippilot@db:5432/trippilot'
    const testUrl = resolveConnectionString({ NODE_ENV: 'test', DATABASE_URL: devUrl })
    expect(testUrl).not.toBe(devUrl)
  })

  it('prefers an explicit TEST_DATABASE_URL when set', () => {
    const result = resolveConnectionString({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://trippilot:trippilot@db:5432/trippilot',
      TEST_DATABASE_URL: 'postgres://trippilot:trippilot@db:5432/custom_test_db',
    })
    expect(result).toBe('postgres://trippilot:trippilot@db:5432/custom_test_db')
  })

  it('falls back to a local default when DATABASE_URL is unset in test mode', () => {
    const result = resolveConnectionString({ NODE_ENV: 'test' })
    expect(result).toBe('postgres://trippilot:trippilot@localhost:5432/trippilot_test')
  })
})
