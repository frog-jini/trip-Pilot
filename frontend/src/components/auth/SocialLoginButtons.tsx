// Google/Kakao 버튼 UI만 담당한다 — 실제 클릭 시 동작(현재는 고정 비밀번호로 데모 계정에
// 로그인/가입하는 loginWithDemoAccount, 진짜 OAuth 아님)은 이 컴포넌트를 쓰는 쪽(LoginPage/
// SignupPage)에서 onGoogleClick/onKakaoClick으로 주입한다.
import { useLanguage } from '../../context/languageContextValue'

interface SocialLoginButtonsProps {
  onGoogleClick?: () => void
  onKakaoClick?: () => void
}

export function SocialLoginButtons({ onGoogleClick, onKakaoClick }: SocialLoginButtonsProps) {
  const { t } = useLanguage()

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onGoogleClick}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <GoogleGlyph />
        {t('auth.googleContinue')}
      </button>

      <button
        type="button"
        onClick={onKakaoClick}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FEE500] px-4 py-2.5 text-sm font-medium text-[#191600] transition-colors hover:brightness-95"
      >
        <KakaoGlyph />
        {t('auth.kakaoContinue')}
      </button>
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.3v3.1C3.3 21.3 7.3 24 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.3A12 12 0 0 0 0 12c0 1.9.5 3.8 1.3 5.4l4.1-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4.1 3.1c.9-2.8 3.5-4.9 6.6-4.9Z"
      />
    </svg>
  )
}

function KakaoGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#191600"
        d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.8 5.3 4.6 6.8-.2.7-.7 2.6-.8 3-.1.5.2.5.4.3.2-.1 2.7-1.8 3.8-2.6.6.1 1.3.1 2 .1 5.5 0 10-3.6 10-8s-4.5-8-10-8Z"
      />
    </svg>
  )
}
