// 로그인 세션을 앱 전역에 제공하는 Provider. 실제 데이터(일정/즐겨찾기 등)는 여기서 다루지 않고,
// "누가 로그인했는지"와 그 세션으로 백엔드를 호출하는 함수들만 담당한다.
import { useState, type ReactNode } from 'react'
import {
  clearStoredToken,
  clearStoredUser,
  readStoredToken,
  readStoredUser,
  writeStoredToken,
  writeStoredUser,
  type AuthUser,
} from '../lib/authStorage'
import { apiRequest, ApiError } from '../lib/apiClient'
import { AuthContext } from './authContextValue'

// Social login isn't really wired up to Google/Kakao yet — clicking those buttons signs the
// demo account in against the real API using a fixed password, so it's a genuine session
// (not a local fake) rather than pretending to do OAuth.
const DEMO_SOCIAL_PASSWORD = 'trippilot-demo-social-login'

interface AuthProviderProps {
  children: ReactNode
  fetchImpl?: typeof fetch
}

export function AuthProvider({ children, fetchImpl }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())
  const [token, setToken] = useState<string | null>(() => readStoredToken())

  function applySession(nextToken: string, nextUser: AuthUser) {
    writeStoredToken(nextToken)
    writeStoredUser(nextUser)
    setToken(nextToken)
    setUser(nextUser)
  }

  // login/signup/updateNickname/updatePassword는 실패해도 throw하지 않고 boolean만 돌려준다 —
  // 호출하는 폼 컴포넌트가 try/catch 없이 "성공했는지"만으로 화면을 분기할 수 있게 하기 위함.
  // ApiError가 아닌 진짜 예외(네트워크 끊김 등)는 그대로 던져서 폼이 삼키지 못하게 한다.
  async function login(email: string, password: string): Promise<boolean> {
    try {
      const response = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
        fetchImpl,
      })
      applySession(response.token, response.user)
      return true
    } catch (error) {
      if (error instanceof ApiError) return false
      throw error
    }
  }

  async function signup(email: string, password: string): Promise<boolean> {
    try {
      const response = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/signup', {
        method: 'POST',
        body: { email, password },
        fetchImpl,
      })
      applySession(response.token, response.user)
      return true
    } catch (error) {
      if (error instanceof ApiError) return false
      throw error
    }
  }

  // 가입 폼에서 이메일 칸을 벗어날 때 미리 물어보는 용도라 실패해도 굳이 폼을 막을 필요가
  // 없다 — ApiError든 진짜 네트워크 에러든 그냥 "일단 available"로 취급하고, 최종 검증은
  // signup()의 409 응답이 어차피 다시 해준다.
  async function checkEmailAvailable(email: string): Promise<boolean> {
    try {
      const response = await apiRequest<{ available: boolean }>(
        `/api/auth/check-email?email=${encodeURIComponent(email)}`,
        { fetchImpl },
      )
      return response.available
    } catch {
      return true
    }
  }

  // 먼저 로그인을 시도하고, 계정이 없어서 실패하면 그 자리에서 바로 가입시킨다 — 소셜 로그인
  // 버튼 하나로 "이미 써본 사람은 로그인, 처음이면 가입"이 자연스럽게 되도록.
  async function loginWithDemoAccount(email: string): Promise<boolean> {
    const loggedIn = await login(email, DEMO_SOCIAL_PASSWORD)
    if (loggedIn) return true
    return signup(email, DEMO_SOCIAL_PASSWORD)
  }

  // Google Identity Services가 로그인 성공 후 돌려준 id_token을 서버로 그대로 넘긴다 — 서버가
  // 구글에 검증을 맡기고, 그 결과로 찾거나 새로 만든 계정의 세션을 돌려준다.
  async function loginWithGoogle(idToken: string): Promise<boolean> {
    try {
      const response = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/oauth/google', {
        method: 'POST',
        body: { idToken },
        fetchImpl,
      })
      applySession(response.token, response.user)
      return true
    } catch (error) {
      if (error instanceof ApiError) return false
      throw error
    }
  }

  // Kakao SDK가 로그인 성공 후 돌려준 access_token을 서버로 그대로 넘긴다 — 서버가 카카오
  // 사용자정보 API로 검증을 맡기고, 그 결과로 찾거나 새로 만든 계정의 세션을 돌려준다.
  async function loginWithKakao(accessToken: string): Promise<boolean> {
    try {
      const response = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/oauth/kakao', {
        method: 'POST',
        body: { accessToken },
        fetchImpl,
      })
      applySession(response.token, response.user)
      return true
    } catch (error) {
      if (error instanceof ApiError) return false
      throw error
    }
  }

  function logout() {
    clearStoredToken()
    clearStoredUser()
    setToken(null)
    setUser(null)
  }

  async function updateNickname(nickname: string): Promise<boolean> {
    if (!token || !user) return false

    try {
      const response = await apiRequest<{ user: AuthUser }>('/api/auth/nickname', {
        method: 'PUT',
        body: { nickname },
        token,
        fetchImpl,
      })
      writeStoredUser(response.user)
      setUser(response.user)
      return true
    } catch (error) {
      if (error instanceof ApiError) return false
      throw error
    }
  }

  async function updatePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    if (!token) return false

    try {
      await apiRequest('/api/auth/password', {
        method: 'PUT',
        body: { currentPassword, newPassword },
        token,
        fetchImpl,
      })
      return true
    } catch (error) {
      if (error instanceof ApiError) return false
      throw error
    }
  }

  async function deleteAccount(): Promise<void> {
    if (token) {
      try {
        await apiRequest('/api/auth/me', { method: 'DELETE', token, fetchImpl })
      } catch {
        // Fall through and clear the local session regardless — there's nothing more
        // the user can do about a failed delete call from this screen.
      }
    }
    logout()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        signup,
        checkEmailAvailable,
        loginWithDemoAccount,
        loginWithGoogle,
        loginWithKakao,
        logout,
        updateNickname,
        updatePassword,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
