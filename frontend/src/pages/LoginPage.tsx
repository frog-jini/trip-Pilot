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
  const { login, loginWithDemoAccount } = useAuth()
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

  // 실제 Google/Kakao OAuth 연동은 안 돼 있다 — 고정 데모 비밀번호로 실제 계정에
  // 로그인하거나(계정이 없으면 즉시 가입)하는 방식으로 "소셜 로그인처럼" 흉내만 낸다.
  async function handleSocialLogin(email: string) {
    await loginWithDemoAccount(email)
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
          onKakaoClick={() => handleSocialLogin('demo-kakao@trippilot.app')}
        />
      </div>
    </AuthLayout>
  )
}
