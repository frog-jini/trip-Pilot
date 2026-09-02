// AuthContext.tsx(Provider 구현)와 이 파일(Context 객체 + useAuth 훅)을 분리해둔 이유: Provider가
// 없는 컴포넌트/훅에서도 타입만 가볍게 import할 수 있게 하고, Fast Refresh가 컴포넌트 파일과
// 비-컴포넌트 export를 섞어서 내보낼 때 겪는 문제를 피하기 위함.
import { createContext, useContext } from 'react'
import type { AuthUser } from '../lib/authStorage'

export interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  login: (email: string, password: string) => Promise<boolean>
  signup: (email: string, password: string) => Promise<boolean>
  checkEmailAvailable: (email: string) => Promise<boolean>
  loginWithDemoAccount: (email: string) => Promise<boolean>
  loginWithGoogle: (idToken: string) => Promise<boolean>
  loginWithKakao: (accessToken: string) => Promise<boolean>
  logout: () => void
  updateNickname: (nickname: string) => Promise<boolean>
  updatePassword: (currentPassword: string, newPassword: string) => Promise<boolean>
  deleteAccount: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
