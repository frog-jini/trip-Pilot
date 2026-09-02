// Kakao 로그인 SDK 로더 + 로그인 트리거. 구글(Google Identity Services)과 달리 카카오는 구글처럼
// 자체 렌더링 버튼을 강제하지 않고, 커스텀 버튼의 클릭 핸들러에서 Kakao.Auth.login()을 직접
// 호출하는 게 공식 지원 방식이다 — 그래서 GoogleSignInButton 같은 별도 렌더링 컴포넌트가
// 필요 없고, SocialLoginButtons가 기존 카카오 버튼 클릭에서 바로 이 함수들을 쓴다.
const KAKAO_SDK_SRC = 'https://developers.kakao.com/sdk/js/kakao.js'

// 광고 차단 확장이나 네트워크 문제로 스크립트 load/error 이벤트 자체가 안 오는 경우를 대비해
// googleIdentity.ts와 동일하게 타임아웃을 둔다.
const LOAD_TIMEOUT_MS = 5000

interface KakaoAuthObj {
  access_token: string
}

interface KakaoGlobal {
  init: (jsKey: string) => void
  isInitialized: () => boolean
  Auth: {
    login: (options: { success: (authObj: KakaoAuthObj) => void; fail: (error: unknown) => void }) => void
  }
}

// window.Kakao도 googleIdentity.ts의 window.google과 같은 이유로(전역 타입 augment는 다른 곳의
// 타입 체크에까지 영향을 주기 쉬움) 이 파일 안에서만 쓰는 타입으로 좁혀서 단언한다.
function getKakaoGlobal(): KakaoGlobal | undefined {
  return (window as unknown as { Kakao?: KakaoGlobal }).Kakao
}

const JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined

export function isKakaoLoginConfigured(): boolean {
  return Boolean(JS_KEY)
}

let loadPromise: Promise<void> | null = null

export function loadKakaoSdkScript(): Promise<void> {
  if (getKakaoGlobal()) return Promise.resolve()
  if (loadPromise) return loadPromise

  const scriptLoad = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${KAKAO_SDK_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('카카오 로그인 스크립트를 불러오지 못했어요.')))
      return
    }

    const script = document.createElement('script')
    script.src = KAKAO_SDK_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('카카오 로그인 스크립트를 불러오지 못했어요.'))
    document.head.appendChild(script)
  })

  const withTimeout = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('카카오 로그인 스크립트 로드가 너무 오래 걸려요.')), LOAD_TIMEOUT_MS)
    scriptLoad.then(
      () => {
        clearTimeout(timer)
        resolve()
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  }).catch((error: unknown) => {
    // 실패한 시도를 캐싱해두면 재시도할 방법이 없으니, 다음 호출에서 다시 시도할 수 있게 비운다.
    loadPromise = null
    throw error
  })

  loadPromise = withTimeout
  return loadPromise
}

/**
 * 카카오 로그인 팝업을 띄우고, 성공하면 access_token을 돌려준다. loadKakaoSdkScript()가 이미
 * resolve된 뒤에만(SDK가 로드된 뒤에만) 호출할 것 — 로드 자체의 성공/실패는 이 함수의 책임이 아니다.
 */
export function loginWithKakao(): Promise<string> {
  if (!JS_KEY) return Promise.reject(new Error('카카오 로그인이 설정되지 않았어요.'))

  const kakao = getKakaoGlobal()
  if (!kakao) return Promise.reject(new Error('카카오 로그인 스크립트가 아직 준비되지 않았어요.'))

  if (!kakao.isInitialized()) kakao.init(JS_KEY)

  return new Promise((resolve, reject) => {
    kakao.Auth.login({
      success: (authObj) => resolve(authObj.access_token),
      fail: (error) => reject(error instanceof Error ? error : new Error('카카오 로그인에 실패했어요.')),
    })
  })
}
