// Google Identity Services(GIS) <script>를 필요할 때 한 번만 불러오는 로더. GoogleSignInButton
// 컴포넌트가 마운트될 때 호출하고, 이미 불러온 뒤라면 곧바로 resolve한다.
//
// window.google은 GIS 스크립트가 로드되면서 런타임에 채워주는 값이라 공식 타입 선언이 없다.
// window 전역을 직접 augment하는 대신(다른 곳의 타입 체크에까지 영향을 주고 충돌하기 쉬움) 이
// 파일 안에서만 쓰는 타입으로 좁혀서 단언(cast)한다.
export interface GoogleCredentialResponse {
  credential: string
}

interface GoogleAccountsId {
  initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      width?: number
    },
  ) => void
}

interface GoogleGlobal {
  accounts: { id: GoogleAccountsId }
}

function getGoogleGlobal(): GoogleGlobal | undefined {
  return (window as unknown as { google?: GoogleGlobal }).google
}

/** GIS 스크립트가 로드된 뒤에만 값이 있다 — loadGoogleIdentityScript()가 resolve된 다음에 호출할 것. */
export function getGoogleAccountsId(): GoogleAccountsId | undefined {
  return getGoogleGlobal()?.accounts.id
}

const GOOGLE_GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

// 광고 차단 확장이나 네트워크 문제로 스크립트의 load/error 이벤트 자체가 안 오는 경우가 있다 —
// onload/onerror만 믿고 기다리면 버튼이 영원히 안 뜨니, 이 시간 안에 안 끝나면 실패로 간주하고
// 호출부(GoogleSignInButton)가 커스텀 데모 버튼으로 대체할 수 있게 해준다.
const LOAD_TIMEOUT_MS = 5000

let loadPromise: Promise<void> | null = null

export function loadGoogleIdentityScript(): Promise<void> {
  if (getGoogleGlobal()?.accounts?.id) return Promise.resolve()
  if (loadPromise) return loadPromise

  const scriptLoad = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_GSI_SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google 로그인 스크립트를 불러오지 못했어요.')))
      return
    }

    const script = document.createElement('script')
    script.src = GOOGLE_GSI_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google 로그인 스크립트를 불러오지 못했어요.'))
    document.head.appendChild(script)
  })

  const withTimeout = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Google 로그인 스크립트 로드가 너무 오래 걸려요.')), LOAD_TIMEOUT_MS)
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
