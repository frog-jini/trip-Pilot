// loadKakaoSdkScript()의 네 갈래(이미 로드됨/스크립트 load 이벤트로 완료/error 이벤트로 실패/
// 너무 오래 걸려 타임아웃)와, 설정 안 됐을 때 loginWithKakao()가 거부하는지를 검증한다. 실제
// developers.kakao.com에는 절대 접속하지 않는다 — <script> 태그를 직접 만들지만 그 load/error
// 이벤트를 테스트에서 수동으로 발생시킨다.
//
// vite.config.ts의 test.env가 VITE_KAKAO_JS_KEY를 항상 빈 문자열로 고정해두므로, 이 파일
// 안에서는 "설정된" 상태(loginWithKakao가 실제로 Kakao.Auth.login을 호출하는 경로)는 검증하지
// 않는다 — 그 경로는 SocialLoginButtons를 통한 통합 동작으로 커버된다.
describe('loadKakaoSdkScript', () => {
  const KAKAO_SCRIPT_SELECTOR = 'script[src="https://developers.kakao.com/sdk/js/kakao.js"]'

  // kakaoAuth.ts는 window.Kakao를 전역 타입으로 선언하지 않고 파일 내부에서만 캐스팅해서 쓴다 —
  // 테스트에서도 같은 방식으로 unknown을 거쳐 캐스팅해 window.Kakao를 지웠다 채웠다 한다.
  function setWindowKakao(value: unknown) {
    ;(window as unknown as { Kakao?: unknown }).Kakao = value
  }

  beforeEach(() => {
    vi.resetModules()
    document.head.innerHTML = ''
    setWindowKakao(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves immediately when the Kakao SDK is already on window', async () => {
    setWindowKakao({ init: vi.fn(), isInitialized: () => true, Auth: { login: vi.fn() } })
    const { loadKakaoSdkScript } = await import('./kakaoAuth')

    await expect(loadKakaoSdkScript()).resolves.toBeUndefined()
    expect(document.head.querySelector(KAKAO_SCRIPT_SELECTOR)).toBeNull()
  })

  it('resolves once the injected script fires its load event', async () => {
    const { loadKakaoSdkScript } = await import('./kakaoAuth')
    const promise = loadKakaoSdkScript()

    const script = document.head.querySelector(KAKAO_SCRIPT_SELECTOR)
    expect(script).not.toBeNull()
    script!.dispatchEvent(new Event('load'))

    await expect(promise).resolves.toBeUndefined()
  })

  it('rejects when the script fires an error event', async () => {
    const { loadKakaoSdkScript } = await import('./kakaoAuth')
    const promise = loadKakaoSdkScript()

    document.head.querySelector(KAKAO_SCRIPT_SELECTOR)!.dispatchEvent(new Event('error'))

    await expect(promise).rejects.toThrow()
  })

  it('rejects if loading stalls past the timeout (blocked script, dead network, etc.)', async () => {
    vi.useFakeTimers()
    const { loadKakaoSdkScript } = await import('./kakaoAuth')
    const promise = loadKakaoSdkScript()
    const settled = promise.then(
      () => 'resolved',
      () => 'rejected',
    )

    await vi.advanceTimersByTimeAsync(6000)

    expect(await settled).toBe('rejected')
  })
})

describe('isKakaoLoginConfigured / loginWithKakao', () => {
  it('reports not configured and rejects a login attempt when VITE_KAKAO_JS_KEY is unset', async () => {
    const { isKakaoLoginConfigured, loginWithKakao } = await import('./kakaoAuth')

    expect(isKakaoLoginConfigured()).toBe(false)
    await expect(loginWithKakao()).rejects.toThrow()
  })
})
