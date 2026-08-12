// apiRequest()의 공통 요청/에러 처리 규약을 검증한다 — 다른 모든 lib/*Storage.ts, communityTrips.ts
// 등이 이 함수를 통해서만 백엔드와 통신하므로, 여기서 깨지면 앱 전체 API 호출이 영향을 받는다.
import { ApiError, apiRequest } from './apiClient'

function fakeFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('apiRequest', () => {
  it('sends a GET request to the configured base URL by default', async () => {
    const fetchImpl = fakeFetch(200, { hello: 'world' })
    const result = await apiRequest('/api/health', { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:4000/api/health',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toEqual({ hello: 'world' })
  })

  it('sends a JSON body and content-type header for POST requests', async () => {
    const fetchImpl = fakeFetch(201, { ok: true })
    await apiRequest('/api/trips', { method: 'POST', body: { destination: '도쿄' }, fetchImpl })

    const [, init] = fetchImpl.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ destination: '도쿄' }))
  })

  it('attaches an Authorization header when a token is given', async () => {
    const fetchImpl = fakeFetch(200, {})
    await apiRequest('/api/trips', { token: 'abc123', fetchImpl })

    const [, init] = fetchImpl.mock.calls[0]
    expect(init.headers['Authorization']).toBe('Bearer abc123')
  })

  it('omits the Authorization header when no token is given', async () => {
    const fetchImpl = fakeFetch(200, {})
    await apiRequest('/api/community', { fetchImpl })

    const [, init] = fetchImpl.mock.calls[0]
    expect(init.headers['Authorization']).toBeUndefined()
  })

  it('returns null for a 204 No Content response without parsing a body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('no body')),
    })

    const result = await apiRequest('/api/trips/1', { method: 'DELETE', fetchImpl })
    expect(result).toBeNull()
  })

  it('throws an ApiError with the server message when the response is not ok', async () => {
    const fetchImpl = fakeFetch(401, { error: '로그인이 필요해요.' })

    await expect(apiRequest('/api/trips', { fetchImpl })).rejects.toMatchObject({
      status: 401,
      message: '로그인이 필요해요.',
    })
  })

  it('throws a generic message when the error response has no parseable body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('bad json')),
    })

    await expect(apiRequest('/api/trips', { fetchImpl })).rejects.toBeInstanceOf(ApiError)
    await expect(apiRequest('/api/trips', { fetchImpl })).rejects.toMatchObject({ status: 500 })
  })
})
