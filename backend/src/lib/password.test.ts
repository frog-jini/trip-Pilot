import { hashPassword, verifyPassword } from './password.js'

describe('password hashing', () => {
  it('produces a hash different from the original password', async () => {
    const hash = await hashPassword('password1')
    expect(hash).not.toBe('password1')
  })

  // 같은 비밀번호라도 매번 다른 salt를 쓴다는 걸 확인한다 — salt가 고정이면 같은 비밀번호를 쓰는
  // 계정끼리 해시만 보고도 비밀번호가 같다는 걸 알 수 있어 salt를 쓰는 의미가 없어진다.
  it('produces a different hash each time (random salt)', async () => {
    const first = await hashPassword('password1')
    const second = await hashPassword('password1')
    expect(first).not.toBe(second)
  })

  it('verifies a matching password against its hash', async () => {
    const hash = await hashPassword('password1')
    expect(await verifyPassword('password1', hash)).toBe(true)
  })

  it('rejects a non-matching password', async () => {
    const hash = await hashPassword('password1')
    expect(await verifyPassword('wrongpassword', hash)).toBe(false)
  })
})
