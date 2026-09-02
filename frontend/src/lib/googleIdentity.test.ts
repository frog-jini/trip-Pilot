// loadGoogleIdentityScript()의 세 갈래(이미 로드됨/스크립트 load 이벤트로 완료/너무 오래 걸려
// 타임아웃)를 검증한다. 실제 accounts.google.com에는 절대 접속하지 않는다 — <script> 태그를
// 직접 만들지만 그 load/error 이벤트를 테스트에서 수동으로 발생시킨다.
describe('loadGoogleIdentityScript', () => {
  const GOOGLE_SCRIPT_SELECTOR = 'script[src="https://accounts.google.com/gsi/client"]'

  // googleIdentity.ts는 window.google을 전역 타입으로 선언하지 않고 파일 내부에서만 캐스팅해서
  // 쓴다 — 테스트에서도 같은 방식으로 unknown을 거쳐 캐스팅해 window.google을 지웠다 채웠다 한다.
  function setWindowGoogle(value: unknown) {
    ;(window as unknown as { google?: unknown }).google = value
  }

  beforeEach(() => {
    vi.resetModules()
    document.head.innerHTML = ''
    setWindowGoogle(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves immediately when Google Identity Services is already on window', async () => {
    setWindowGoogle({ accounts: { id: {} } })
    const { loadGoogleIdentityScript } = await import('./googleIdentity')

    await expect(loadGoogleIdentityScript()).resolves.toBeUndefined()
    expect(document.head.querySelector(GOOGLE_SCRIPT_SELECTOR)).toBeNull()
  })

  it('resolves once the injected script fires its load event', async () => {
    const { loadGoogleIdentityScript } = await import('./googleIdentity')
    const promise = loadGoogleIdentityScript()

    const script = document.head.querySelector(GOOGLE_SCRIPT_SELECTOR)
    expect(script).not.toBeNull()
    script!.dispatchEvent(new Event('load'))

    await expect(promise).resolves.toBeUndefined()
  })

  it('rejects when the script fires an error event', async () => {
    const { loadGoogleIdentityScript } = await import('./googleIdentity')
    const promise = loadGoogleIdentityScript()

    document.head.querySelector(GOOGLE_SCRIPT_SELECTOR)!.dispatchEvent(new Event('error'))

    await expect(promise).rejects.toThrow()
  })

  it('rejects if loading stalls past the timeout (blocked script, dead network, etc.)', async () => {
    vi.useFakeTimers()
    const { loadGoogleIdentityScript } = await import('./googleIdentity')
    const promise = loadGoogleIdentityScript()
    const settled = promise.then(
      () => 'resolved',
      () => 'rejected',
    )

    await vi.advanceTimersByTimeAsync(6000)

    expect(await settled).toBe('rejected')
  })
})
