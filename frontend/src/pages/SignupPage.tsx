// "/signup" 화면. 이메일 가입 폼과, 데모 계정으로 즉시 로그인하는 소셜 버튼을 함께 보여준다.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { SignupForm } from '../components/auth/SignupForm'
import { SocialLoginButtons } from '../components/auth/SocialLoginButtons'
import { useAuth } from '../context/authContextValue'
import { useLanguage } from '../context/languageContextValue'
import type { SignupFormValues } from '../lib/validation'

export function SignupPage() {
  const navigate = useNavigate()
  const { signup, checkEmailAvailable, loginWithDemoAccount } = useAuth()
  const { t } = useLanguage()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(values: SignupFormValues) {
    const success = await signup(values.email, values.password)

    if (!success) {
      setErrorMessage(t('auth.signupEmailTaken'))
      return
    }

    navigate('/')
  }

  // Google/Kakao 버튼은 실제 OAuth 연동이 아니라, 고정된 데모 이메일로 로그인(없으면 가입)한다.
  // AuthContext.loginWithDemoAccount 주석 참고.
  async function handleSocialLogin(email: string) {
    await loginWithDemoAccount(email)
    navigate('/')
  }

  return (
    <AuthLayout
      title={t('auth.signupTitle')}
      subtitle={t('auth.signupSubtitle')}
      footerText={t('auth.signupFooterText')}
      footerLinkText={t('auth.signupFooterLink')}
      footerLinkHref="/login"
    >
      <div className="space-y-6">
        {errorMessage ? (
          <p role="alert" className="rounded-xl bg-accent-50 px-4 py-2.5 text-sm text-accent-700 dark:bg-accent-950 dark:text-accent-300">
            {errorMessage}
          </p>
        ) : null}

        <SignupForm onSubmit={handleSubmit} onCheckEmail={checkEmailAvailable} />

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
