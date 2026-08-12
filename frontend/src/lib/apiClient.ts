// 백엔드 REST API를 호출하는 유일한 공통 통로. 다른 lib 파일들(tripsStorage, favoritesStorage,
// communityTrips 등)은 전부 이 apiRequest()를 거쳐서만 서버와 통신한다 — 인증 헤더 부착, 에러
// 변환, JSON 파싱 같은 공통 처리를 한 곳에 모아두기 위함.
const DEFAULT_BASE_URL = 'http://localhost:4000'

function baseUrl(): string {
  return import.meta.env.VITE_API_URL ?? DEFAULT_BASE_URL
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  token?: string | null
  // 테스트에서 실제 네트워크 대신 페이크 서버(test/fakeApiServer.ts 등)를 주입하기 위한 통로.
  // 지정하지 않으면 브라우저 전역 fetch를 그대로 쓴다.
  fetchImpl?: typeof fetch
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, fetchImpl = fetch } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetchImpl(`${baseUrl()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // 204 No Content(예: DELETE 성공)는 바디가 없으므로 파싱을 시도하지 않는다. 그 외에는
  // 응답 바디가 JSON이 아니어도(예: 프록시 에러 페이지) 무너지지 않도록 실패를 null로 흡수한다.
  const data = response.status === 204 ? null : await response.json().catch(() => null)

  if (!response.ok) {
    const message = (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string')
      ? data.error
      : '요청을 처리하지 못했어요.'
    throw new ApiError(response.status, message)
  }

  return data as T
}
