// 두 가지 인증 미들웨어를 나눠둔 이유: trips/favorites처럼 항상 로그인이 필요한 라우터는
// requireAuth를, community 목록/상세처럼 비로그인도 볼 수 있지만 로그인 시 liked 같은
// 개인화 정보를 덧붙여야 하는 라우터는 optionalAuth를 쓴다.
import type { NextFunction, Request, Response } from 'express'
import { verifyToken } from '../lib/jwt.js'

export interface AuthedRequest extends Request {
  userId?: string
}

/** "Bearer <token>" 형식이 아니면(헤더 자체가 없거나 다른 스킴이면) 그냥 null. */
function extractToken(req: Request): string | null {
  const header = req.headers.authorization
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
}

/** Rejects the request with 401 unless it carries a valid bearer token. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req)
  const payload = token ? verifyToken(token) : null

  if (!payload) {
    res.status(401).json({ error: '로그인이 필요해요.' })
    return
  }

  req.userId = payload.userId
  next()
}

/** Attaches req.userId when a valid bearer token is present, but never rejects the request. */
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const token = extractToken(req)
  const payload = token ? verifyToken(token) : null
  if (payload) req.userId = payload.userId
  next()
}
