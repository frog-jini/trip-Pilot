// signToken/verifyToken 왕복과, 위조·다른 비밀키·필수 클레임 누락 같은 실패 케이스를 검증한다.
import jwt from 'jsonwebtoken'
import { signToken, verifyToken } from './jwt.js'

describe('jwt', () => {
  it('round-trips a user id through sign and verify', () => {
    const token = signToken('user-123')
    expect(verifyToken(token)).toEqual({ userId: 'user-123' })
  })

  it('rejects a garbage token', () => {
    expect(verifyToken('not-a-real-token')).toBeNull()
  })

  it('rejects a token signed with a different secret', () => {
    const otherToken = jwt.sign({ sub: 'user-123' }, 'a-completely-different-secret')
    expect(verifyToken(otherToken)).toBeNull()
  })

  it('rejects a token with no subject claim', () => {
    const badToken = jwt.sign({ hello: 'world' }, process.env.JWT_SECRET ?? 'dev-secret-change-me')
    expect(verifyToken(badToken)).toBeNull()
  })
})
