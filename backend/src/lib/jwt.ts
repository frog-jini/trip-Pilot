// 로그인 세션을 JWT로 발급/검증하는 곳. 서버는 세션을 DB에 저장하지 않는다 — 토큰 자체에
// userId가 서명되어 있어서, 유효한 토큰이면 그것만으로 신뢰한다(무상태 인증).
import jwt from 'jsonwebtoken'

// 운영 환경에서는 반드시 환경변수로 실제 비밀키를 넣어야 한다 — 기본값은 로컬 개발 편의용.
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'
const EXPIRES_IN = '7d'

export interface TokenPayload {
  userId: string
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: EXPIRES_IN })
}

// 서명이 안 맞거나(비밀키 불일치), 만료됐거나, 형식이 아예 잘못된 토큰이면 jwt.verify가
// 예외를 던진다 — 호출부(middleware/auth.ts)가 매번 try/catch할 필요 없이 null만 확인하면
// 되도록 여기서 흡수한다.
export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (typeof payload === 'object' && payload !== null && typeof payload.sub === 'string') {
      return { userId: payload.sub }
    }
    return null
  } catch {
    return null
  }
}
