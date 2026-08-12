// 로그인 세션(토큰/사용자)을 localStorage에 넣고 빼는 authStorage.ts를 검증한다.
// 손상된 JSON을 넣어보는 케이스가 있는 이유: 다른 앱이나 이전 버전이 같은 키에 이상한 값을
// 남겨놔도 읽기 시점에 죽지 않고 그냥 "저장된 게 없다"로 안전하게 처리돼야 하기 때문.
import {
  clearStoredToken,
  clearStoredUser,
  readStoredToken,
  readStoredUser,
  writeStoredToken,
  writeStoredUser,
} from './authStorage'

describe('stored user', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('returns null when no user has been stored', () => {
    expect(readStoredUser()).toBeNull()
  })

  it('returns the previously written user', () => {
    writeStoredUser({ email: 'user@example.com' })
    expect(readStoredUser()).toEqual({ email: 'user@example.com' })
  })

  it('returns null after the stored user is cleared', () => {
    writeStoredUser({ email: 'user@example.com' })
    clearStoredUser()
    expect(readStoredUser()).toBeNull()
  })

  it('returns null when the stored value is corrupted JSON', () => {
    localStorage.setItem('trippilot_user', '{not-json')
    expect(readStoredUser()).toBeNull()
  })
})

describe('stored token', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('returns null when no token has been stored', () => {
    expect(readStoredToken()).toBeNull()
  })

  it('returns the previously written token', () => {
    writeStoredToken('abc123')
    expect(readStoredToken()).toBe('abc123')
  })

  it('returns null after the stored token is cleared', () => {
    writeStoredToken('abc123')
    clearStoredToken()
    expect(readStoredToken()).toBeNull()
  })
})
