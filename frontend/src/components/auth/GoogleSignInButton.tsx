// 진짜 구글 로그인 버튼. Google Identity Services는 클릭재킹 방지를 위해 자체적으로 렌더링한
// 버튼/iframe만 신뢰하므로, 우리 색으로 커스텀 버튼을 그릴 수는 없다 — 대신 이 컨테이너에 구글이
// 직접 버튼을 그려 넣는다. VITE_GOOGLE_CLIENT_ID가 없거나 스크립트 로드에 실패하면 아무것도
// 그리지 않고 조용히 실패한다 — 호출부(SocialLoginButtons)가 이 경우 커스텀 데모 버튼으로 대체한다.
import { useEffect, useRef, useState } from 'react'
import { getGoogleAccountsId, loadGoogleIdentityScript } from '../../lib/googleIdentity'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

// GIS의 initialize()는 window.google.accounts.id라는 전역 싱글턴에 콜백을 등록하는 것이라,
// React StrictMode의 개발 모드 이펙트 이중 실행(mount→cleanup→mount)에서 매번 다시 부르면
// "initialize() is called multiple times" 경고가 뜬다 — 콜백은 항상 onCredentialRef를 거쳐
// 최신 값을 참조하므로 실제로 다시 초기화할 필요는 없어서, 앱 전체에서 최초 1회만 부른다.
let googleInitialized = false

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void
  onUnavailable: () => void
}

export function GoogleSignInButton({ onCredential, onUnavailable }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onCredentialRef = useRef(onCredential)
  const [ready, setReady] = useState(false)

  // 렌더링 중에 ref를 직접 대입하지 않고, 매 렌더 뒤 이펙트에서만 최신 콜백으로 갱신한다 —
  // GIS의 callback은 initialize() 시점에 한 번만 등록되므로, 나중에 바뀐 onCredential도
  // 이 ref를 통해 항상 최신 값으로 호출되게 하기 위함.
  useEffect(() => {
    onCredentialRef.current = onCredential
  })

  useEffect(() => {
    if (!CLIENT_ID) {
      onUnavailable()
      return
    }

    let cancelled = false

    loadGoogleIdentityScript()
      .then(() => {
        const accountsId = getGoogleAccountsId()
        if (cancelled || !containerRef.current || !accountsId) return

        // GIS renderButton은 퍼센트 폭을 지원하지 않고 고정 픽셀 값만 받는다(최대 400) — 고정값을
        // 그대로 쓰면 카드 폭(max-w-sm 기준 실제로는 400px보다 훨씬 좁음)을 넘어서서 카카오 버튼과
        // 폭이 안 맞았다. containerRef는 아직 display:none이라 자기 자신의 폭을 잴 수 없으니,
        // 항상 화면에 그려져 있는 부모(SocialLoginButtons의 space-y-3 wrapper)의 실제 폭을 잰다.
        const availableWidth = containerRef.current.parentElement?.clientWidth
        const width = Math.round(Math.min(availableWidth || 400, 400))

        if (!googleInitialized) {
          accountsId.initialize({
            client_id: CLIENT_ID,
            callback: (response) => onCredentialRef.current(response.credential),
          })
          googleInitialized = true
        }
        accountsId.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width,
        })
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) onUnavailable()
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onUnavailable/onCredential are read once per mount, via onCredentialRef for the callback
  }, [])

  return <div ref={containerRef} className={ready ? 'flex w-full justify-center' : 'hidden'} />
}
