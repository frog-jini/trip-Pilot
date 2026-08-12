// app.ts에 라우터가 전부 올바르게 연결됐는지 확인하는 최소한의 스모크 테스트.
import request from 'supertest'
import { app } from './app.js'

describe('app', () => {
  it('responds to a health check', async () => {
    const response = await request(app).get('/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })
})
