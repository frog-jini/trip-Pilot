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
  const { signup, checkEmailAvailable, loginWithDemoAccount, loginWithGoogle, loginWithKakao } = useAuth()
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

  // 구글/카카오 버튼이 설정 안 됐거나 SDK 로드에 실패했을 때의 대체 경로 — 고정된 데모
  // 이메일로 로그인(없으면 가입)한다. AuthContext.loginWithDemoAccount 주석 참고.
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
          onGoogleCredential={handleGoogleCredential}
          onKakaoClick={() => handleSocialLogin('demo-kakao@trippilot.app')}
          onKakaoCredential={handleKakaoCredential}
        />
      </div>
    </AuthLayout>
  )
}
