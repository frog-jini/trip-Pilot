// 로그인 세션(JWT 토큰 + 사용자 정보)만 localStorage에 남겨두는 곳. 일정·즐겨찾기 같은 실제
// 데이터는 전부 백엔드 API에 저장되고, 여기는 "지금 로그인한 사람이 누구인지"만 기억한다.
const USER_KEY = 'trippilot_user'
const TOKEN_KEY = 'trippilot_token'

export interface AuthUser {
  id?: string
  email: string
  // 구글 이름/카카오 닉네임. 이메일/비밀번호 가입 계정은 null(또는 응답에 없으면 undefined).
  // 화면에는 이게 있으면 이걸, 없으면 email을 대신 보여준다(Header.tsx 참고).
  nickname?: string | null
}

export function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function writeStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredUser(): void {
  localStorage.removeItem(USER_KEY)
}

export function readStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function writeStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}
