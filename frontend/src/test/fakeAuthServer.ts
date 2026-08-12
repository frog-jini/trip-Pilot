// A tiny in-memory stand-in for the backend's /api/auth/* routes, used to drive
// AuthContext (and anything that renders it) in tests without hitting a real server.
// 실제 JWT를 흉내내지 않고 그냥 user.id를 토큰으로 그대로 쓴다 — 테스트에서는 서명 검증이
// 필요 없고, findByToken(token)이 id로 바로 사용자를 찾을 수 있어 훨씬 단순해진다.
interface FakeUser {
  id: string
  email: string
  password: string
}

function jsonResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response
}

export interface FakeAuthServer {
  fetchImpl: typeof fetch
  users: Map<string, FakeUser>
}

export function createFakeAuthServer(): FakeAuthServer {
  const usersByEmail = new Map<string, FakeUser>()
  let nextId = 1

  function findByToken(token: string | null): FakeUser | null {
    if (!token) return null
    for (const user of usersByEmail.values()) {
      if (user.id === token) return user
    }
    return null
  }

  const fetchImpl = vi.fn(async (url: string | URL, init: RequestInit = {}): Promise<Response> => {
    const path = url.toString().replace('http://localhost:4000', '')
    const method = init.method ?? 'GET'
    const body = init.body ? JSON.parse(init.body as string) : {}
    const authHeader = (init.headers as Record<string, string> | undefined)?.Authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
    const currentUser = findByToken(token)

    if (method === 'GET' && path.startsWith('/api/auth/check-email')) {
      const email = new URL(path, 'http://localhost').searchParams.get('email') ?? ''
      return jsonResponse(200, { available: !usersByEmail.has(email) })
    }

    if (method === 'POST' && path === '/api/auth/signup') {
      if (usersByEmail.has(body.email)) {
        return jsonResponse(409, { error: '이미 가입된 이메일이에요.' })
      }
      const id = String(nextId++)
      usersByEmail.set(body.email, { id, email: body.email, password: body.password })
      return jsonResponse(201, { token: id, user: { id, email: body.email } })
    }

    if (method === 'POST' && path === '/api/auth/login') {
      const found = usersByEmail.get(body.email)
      if (!found || found.password !== body.password) {
        return jsonResponse(401, { error: '이메일 또는 비밀번호가 올바르지 않아요.' })
      }
      return jsonResponse(200, { token: found.id, user: { id: found.id, email: found.email } })
    }

    if (method === 'PUT' && path === '/api/auth/email') {
      if (!currentUser) return jsonResponse(401, { error: '로그인이 필요해요.' })
      if (usersByEmail.has(body.email)) return jsonResponse(409, { error: '이미 사용 중인 이메일이에요.' })
      usersByEmail.delete(currentUser.email)
      currentUser.email = body.email
      usersByEmail.set(body.email, currentUser)
      return jsonResponse(200, { user: { id: currentUser.id, email: currentUser.email } })
    }

    if (method === 'PUT' && path === '/api/auth/password') {
      if (!currentUser) return jsonResponse(401, { error: '로그인이 필요해요.' })
      if (currentUser.password !== body.currentPassword) {
        return jsonResponse(401, { error: '현재 비밀번호가 올바르지 않아요.' })
      }
      currentUser.password = body.newPassword
      return jsonResponse(200, { success: true })
    }

    if (method === 'DELETE' && path === '/api/auth/me') {
      if (!currentUser) return jsonResponse(401, { error: '로그인이 필요해요.' })
      usersByEmail.delete(currentUser.email)
      return jsonResponse(204, null)
    }

    return jsonResponse(404, { error: `no fake route for ${method} ${path}` })
  })

  return { fetchImpl: fetchImpl as unknown as typeof fetch, users: usersByEmail }
}
