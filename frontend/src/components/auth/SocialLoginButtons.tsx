// Google은 GIS가 자체 렌더링한 버튼만 신뢰해서 별도 컴포넌트(GoogleSignInButton)를 쓰지만,
// Kakao는 커스텀 버튼의 클릭 핸들러에서 Kakao.Auth.login()을 직접 호출하는 게 공식 지원
// 방식이라 이 컴포넌트 안에서 바로 처리한다. 둘 다 설정(VITE_..._KEY)이 없거나 SDK 로드에
// 실패하면 조용히 데모 로그인(onGoogleClick/onKakaoClick)으로 대체된다 — 다만 SDK가 정상
// 로드된 뒤 사용자가 로그인 자체를 취소/실패한 경우(예: 팝업을 닫음)는 데모 로그인으로
// 대신 들어가면 사용자가 의도하지 않은 로그인이 되어버리니, 그 경우는 아무 것도 하지 않는다.
import { useState } from 'react'
import { useLanguage } from '../../context/languageContextValue'
import { GoogleSignInButton } from './GoogleSignInButton'
import { isKakaoLoginConfigured, loadKakaoSdkScript, loginWithKakao } from '../../lib/kakaoAuth'

interface SocialLoginButtonsProps {
  onGoogleClick?: () => void
  onGoogleCredential?: (idToken: string) => void
  onKakaoClick?: () => void
  onKakaoCredential?: (accessToken: string) => void
}

export function SocialLoginButtons({
  onGoogleClick,
  onGoogleCredential,
  onKakaoClick,
  onKakaoCredential,
}: SocialLoginButtonsProps) {
  const { t } = useLanguage()
  const [googleUnavailable, setGoogleUnavailable] = useState(false)
  // 카카오 로그인 팝업은 우리 화면이 아니라 카카오 SDK가 직접 띄우는 별도 브라우저 창이라, 이미
  // 카카오에 로그인돼 있으면 뜨자마자 바로 닫혀버린다 — 그 사이 우리 화면이 아무 반응도 없으면
  // 마치 아무 일도 안 일어난 것처럼 보여서, 버튼을 누른 순간부터 로딩 상태를 보여준다.
  const [kakaoPending, setKakaoPending] = useState(false)

  async function handleKakaoClick() {
    if (!isKakaoLoginConfigured()) {
      onKakaoClick?.()
      return
    }

    setKakaoPending(true)

    try {
      await loadKakaoSdkScript()
    } catch (error) {
      console.error('Kakao SDK failed to load:', error)
      onKakaoClick?.()
      setKakaoPending(false)
      return
    }

    try {
      const accessToken = await loginWithKakao()
      onKakaoCredential?.(accessToken)
    } catch (error) {
      // SDK는 정상 로드됐지만 사용자가 팝업을 닫는 등 실제 로그인 자체를 취소/실패한 경우 —
      // 데모 계정으로 대신 들어가진 않고 다시 시도할 수 있게 두되, 원인 파악을 위해 콘솔에는
      // 남겨둔다(예: 카카오 개발자 콘솔에 Web 플랫폼 도메인이 등록 안 된 경우 여기서 실패한다).
      console.error('Kakao login failed:', error)
    } finally {
      setKakaoPending(false)
    }
  }

  return (
    <div className="space-y-3">
      {!googleUnavailable ? (
        <GoogleSignInButton
          onCredential={(idToken) => onGoogleCredential?.(idToken)}
          onUnavailable={() => setGoogleUnavailable(true)}
        />
      ) : (
        <button
          type="button"
          onClick={onGoogleClick}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <GoogleGlyph />
          {t('auth.googleContinue')}
        </button>
      )}

      <button
        type="button"
        onClick={handleKakaoClick}
        disabled={kakaoPending}
        aria-busy={kakaoPending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FEE500] px-4 py-2.5 text-sm font-medium text-[#191600] transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {kakaoPending ? (
          t('auth.socialLoginInProgress')
        ) : (
          <>
            <KakaoGlyph />
            {t('auth.kakaoContinue')}
          </>
        )}
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
