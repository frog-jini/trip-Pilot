import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { LoginForm } from '../components/auth/LoginForm'
import { SocialLoginButtons } from '../components/auth/SocialLoginButtons'
import { useAuth } from '../context/authContextValue'
import { useLanguage } from '../context/languageContextValue'
import type { LoginFormValues } from '../lib/validation'

// /login 화면. 이메일 로그인과, 고정 데모 계정으로 로그인/자동가입하는 "소셜 로그인" 버튼을 함께 둔다.
export function LoginPage() {
  const navigate = useNavigate()
  const { login, loginWithDemoAccount, loginWithGoogle, loginWithKakao } = useAuth()
  const { t } = useLanguage()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(values: LoginFormValues) {
    const success = await login(values.email, values.password)
    if (!success) {
      setErrorMessage(t('auth.loginInvalidCredentials'))
      return
    }
    navigate('/')
  }

  // 구글/카카오 버튼이 설정 안 됐거나 SDK 로드에 실패했을 때의 대체 경로 — 고정 데모 비밀번호로
  // 실제 계정에 로그인하거나(계정이 없으면 즉시 가입)하는 방식으로 흉내만 낸다.
  async function handleSocialLogin(email: string) {
    await loginWithDemoAccount(email)
    navigate('/')
  }

  // Google은 진짜 OAuth다 — SocialLoginButtons가 구글에서 검증까지 끝낸 id_token을 넘겨주면
  // 그대로 서버에 전달해서 세션을 받는다.
  async function handleGoogleCredential(idToken: string) {
    const success = await loginWithGoogle(idToken)
    if (!success) {
      setErrorMessage(t('auth.socialLoginFailed'))
      return
    }
    navigate('/')
  }

  // Kakao도 진짜 OAuth다 — SocialLoginButtons가 카카오 로그인으로 받은 access_token을 넘겨주면
  // 그대로 서버에 전달해서 세션을 받는다.
  async function handleKakaoCredential(accessToken: string) {
    const success = await loginWithKakao(accessToken)
    if (!success) {
      setErrorMessage(t('auth.socialLoginFailed'))
      return
    }
    navigate('/')
  }

  return (
    <AuthLayout
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      footerText={t('auth.loginFooterText')}
      footerLinkText={t('auth.loginFooterLink')}
      footerLinkHref="/signup"
    >
      <div className="space-y-6">
        {errorMessage ? (
          <p
            role="alert"
            className="rounded-xl bg-accent-50 px-4 py-2.5 text-sm text-accent-700 dark:bg-accent-950 dark:text-accent-300"
          >
            {errorMessage}
          </p>
        ) : null}

        <LoginForm onSubmit={handleSubmit} />

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          {t('auth.orDivider')}
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        <SocialLoginButtons
          onGoogleClick={() => handleSocialLogin('demo-google@trippilot.app')}
          onGoogleCredential={handleGoogleCredential}
          onKakaoClick={() => handleSocialLogin('demo-kakao@trippilot.app')}
          onKakaoCredential={handleKakaoCredential}
        />
      </div>
    </AuthLayout>
  )
}
