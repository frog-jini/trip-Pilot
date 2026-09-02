// Context는 훅으로만 쓰이므로, 실제 소비 컴포넌트(TestConsumer)를 하나 만들어 로그인/가입/
// 데모로그인/정보수정/탈퇴 흐름과 localStorage 세션 저장을 fakeAuthServer로 검증한다.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { AuthProvider } from './AuthContext'
import { useAuth } from './authContextValue'
import { readStoredToken, readStoredUser, writeStoredToken, writeStoredUser } from '../lib/authStorage'
import { createFakeAuthServer } from '../test/fakeAuthServer'

// login/signup/updateNickname/updatePassword가 실패 시 throw 대신 boolean(false)을 돌려주므로,
// 버튼 클릭 결과를 화면 텍스트로 남겨서 성공/실패 둘 다 눈으로 확인할 수 있게 한다.
function TestConsumer() {
  const {
    user,
    login,
    signup,
    checkEmailAvailable,
    loginWithDemoAccount,
    loginWithGoogle,
    loginWithKakao,
    logout,
    updateNickname,
    updatePassword,
    deleteAccount,
  } = useAuth()
  const [result, setResult] = useState<string>('')

  async function run(label: string, action: () => Promise<boolean> | Promise<void>) {
    const outcome = await action()
    setResult(`${label}:${outcome === undefined ? 'done' : outcome}`)
  }

  return (
    <div>
      <p>{user ? `로그인됨: ${user.email}` : '로그아웃 상태'}</p>
      <p>결과: {result}</p>
      <button onClick={() => run('login', () => login('login@example.com', 'password1'))}>로그인 실행</button>
      <button onClick={() => run('login', () => login('login@example.com', 'wrongpassword'))}>
        틀린 비밀번호로 로그인 실행
      </button>
      <button onClick={() => run('signup', () => signup('signup@example.com', 'password1'))}>가입 실행</button>
      <button onClick={() => run('checkEmail', () => checkEmailAvailable('login@example.com'))}>
        이메일 확인 실행
      </button>
      <button onClick={() => run('demo', () => loginWithDemoAccount('demo@example.com'))}>데모 로그인 실행</button>
      <button onClick={() => run('google', () => loginWithGoogle('google-sub-1|google@example.com'))}>
        구글 로그인 실행
      </button>
      <button onClick={() => run('kakao', () => loginWithKakao('kakao-token-1|kakao@example.com'))}>
        카카오 로그인 실행
      </button>
      <button onClick={() => run('updateNickname', () => updateNickname('개굴'))}>닉네임 변경 실행</button>
      <button onClick={() => run('updatePassword', () => updatePassword('password1', 'newpassword1'))}>
        비밀번호 변경 실행
      </button>
      <button onClick={() => run('updatePassword', () => updatePassword('wrongpassword', 'newpassword1'))}>
        잘못된 비밀번호로 변경 실행
      </button>
      <button onClick={() => run('delete', () => deleteAccount())}>탈퇴 실행</button>
      <button onClick={() => logout()}>로그아웃 실행</button>
    </div>
  )
}

function renderWithServer(fetchImpl: typeof fetch) {
  return render(
    <AuthProvider fetchImpl={fetchImpl}>
      <TestConsumer />
    </AuthProvider>,
  )
}

describe('AuthContext', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('starts logged out when nothing is stored', () => {
    const { fetchImpl } = createFakeAuthServer()
    renderWithServer(fetchImpl)
    expect(screen.getByText('로그아웃 상태')).toBeInTheDocument()
  })

  it('rehydrates a previously stored session on mount', () => {
    writeStoredUser({ id: '1', email: 'saved@example.com' })
    writeStoredToken('1')
    const { fetchImpl } = createFakeAuthServer()

    renderWithServer(fetchImpl)

    expect(screen.getByText('로그인됨: saved@example.com')).toBeInTheDocument()
  })

  it('logs in with the correct password and persists the session', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    server.users.set('login@example.com', { id: '1', email: 'login@example.com', password: 'password1' })
    renderWithServer(server.fetchImpl)

    await user.click(screen.getByRole('button', { name: '로그인 실행' }))

    expect(await screen.findByText('로그인됨: login@example.com')).toBeInTheDocument()
    expect(await screen.findByText('결과: login:true')).toBeInTheDocument()
    expect(readStoredUser()).toMatchObject({ email: 'login@example.com' })
    expect(readStoredToken()).toBe('1')
  })

  it('rejects a login with the wrong password and does not start a session', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    server.users.set('login@example.com', { id: '1', email: 'login@example.com', password: 'password1' })
    renderWithServer(server.fetchImpl)

    await user.click(screen.getByRole('button', { name: '틀린 비밀번호로 로그인 실행' }))

    expect(await screen.findByText('결과: login:false')).toBeInTheDocument()
    expect(screen.getByText('로그아웃 상태')).toBeInTheDocument()
  })

  it('signup creates the account, logs in, and persists the session', async () => {
    const user = userEvent.setup()
    const { fetchImpl } = createFakeAuthServer()
    renderWithServer(fetchImpl)

    await user.click(screen.getByRole('button', { name: '가입 실행' }))

    expect(await screen.findByText('로그인됨: signup@example.com')).toBeInTheDocument()
    expect(await screen.findByText('결과: signup:true')).toBeInTheDocument()
    expect(readStoredUser()).toMatchObject({ email: 'signup@example.com' })
  })

  it('rejects signing up again with an email that is already registered', async () => {
    const user = userEvent.setup()
    const { fetchImpl } = createFakeAuthServer()
    renderWithServer(fetchImpl)

    await user.click(screen.getByRole('button', { name: '가입 실행' }))
    await screen.findByText('결과: signup:true')
    await user.click(screen.getByRole('button', { name: '로그아웃 실행' }))
    await user.click(screen.getByRole('button', { name: '가입 실행' }))

    expect(await screen.findByText('결과: signup:false')).toBeInTheDocument()
    expect(screen.getByText('로그아웃 상태')).toBeInTheDocument()
  })

  it('reports an email as available when nobody has it', async () => {
    const user = userEvent.setup()
    const { fetchImpl } = createFakeAuthServer()
    renderWithServer(fetchImpl)

    await user.click(screen.getByRole('button', { name: '이메일 확인 실행' }))

    expect(await screen.findByText('결과: checkEmail:true')).toBeInTheDocument()
  })

  it('reports an email as unavailable once it is registered', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    server.users.set('login@example.com', { id: '1', email: 'login@example.com', password: 'password1' })
    renderWithServer(server.fetchImpl)

    await user.click(screen.getByRole('button', { name: '이메일 확인 실행' }))

    expect(await screen.findByText('결과: checkEmail:false')).toBeInTheDocument()
  })

  it('logs in with a demo account for the first time by signing it up automatically', async () => {
    const user = userEvent.setup()
    const { fetchImpl } = createFakeAuthServer()
    renderWithServer(fetchImpl)

    await user.click(screen.getByRole('button', { name: '데모 로그인 실행' }))

    expect(await screen.findByText('로그인됨: demo@example.com')).toBeInTheDocument()
  })

  it('logs in with a demo account on a repeat visit using the existing account', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    renderWithServer(server.fetchImpl)

    await user.click(screen.getByRole('button', { name: '데모 로그인 실행' }))
    await screen.findByText('로그인됨: demo@example.com')
    await user.click(screen.getByRole('button', { name: '로그아웃 실행' }))

    await user.click(screen.getByRole('button', { name: '데모 로그인 실행' }))

    expect(await screen.findByText('로그인됨: demo@example.com')).toBeInTheDocument()
    expect(server.users.size).toBe(1)
  })

  it('logs in with google using the server-verified profile', async () => {
    const user = userEvent.setup()
    const { fetchImpl } = createFakeAuthServer()
    renderWithServer(fetchImpl)

    await user.click(screen.getByRole('button', { name: '구글 로그인 실행' }))

    expect(await screen.findByText('로그인됨: google@example.com')).toBeInTheDocument()
  })

  it('logs in with kakao using the server-verified profile', async () => {
    const user = userEvent.setup()
    const { fetchImpl } = createFakeAuthServer()
    renderWithServer(fetchImpl)

    await user.click(screen.getByRole('button', { name: '카카오 로그인 실행' }))

    expect(await screen.findByText('로그인됨: kakao@example.com')).toBeInTheDocument()
  })

  it('logout clears the user and storage', async () => {
    const user = userEvent.setup()
    writeStoredUser({ id: '1', email: 'saved@example.com' })
    writeStoredToken('1')
    const { fetchImpl } = createFakeAuthServer()
    renderWithServer(fetchImpl)

    await user.click(screen.getByRole('button', { name: '로그아웃 실행' }))

    expect(screen.getByText('로그아웃 상태')).toBeInTheDocument()
    expect(readStoredUser()).toBeNull()
    expect(readStoredToken()).toBeNull()
  })

  it('updates the nickname independently of the email', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    server.users.set('login@example.com', { id: '1', email: 'login@example.com', password: 'password1' })
    renderWithServer(server.fetchImpl)

    await user.click(screen.getByRole('button', { name: '로그인 실행' }))
    await screen.findByText('로그인됨: login@example.com')
    await user.click(screen.getByRole('button', { name: '닉네임 변경 실행' }))

    expect(await screen.findByText('결과: updateNickname:true')).toBeInTheDocument()
    expect(readStoredUser()).toMatchObject({ email: 'login@example.com', nickname: '개굴' })
  })

  it('changes the password when the current password matches', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    server.users.set('login@example.com', { id: '1', email: 'login@example.com', password: 'password1' })
    renderWithServer(server.fetchImpl)

    await user.click(screen.getByRole('button', { name: '로그인 실행' }))
    await screen.findByText('로그인됨: login@example.com')
    await user.click(screen.getByRole('button', { name: '비밀번호 변경 실행' }))

    expect(await screen.findByText('결과: updatePassword:true')).toBeInTheDocument()
  })

  it('rejects a password change when the current password does not match', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    server.users.set('login@example.com', { id: '1', email: 'login@example.com', password: 'password1' })
    renderWithServer(server.fetchImpl)

    await user.click(screen.getByRole('button', { name: '로그인 실행' }))
    await screen.findByText('로그인됨: login@example.com')
    await user.click(screen.getByRole('button', { name: '잘못된 비밀번호로 변경 실행' }))

    expect(await screen.findByText('결과: updatePassword:false')).toBeInTheDocument()
  })

  it('deletes the account, clearing the session', async () => {
    const user = userEvent.setup()
    const { fetchImpl } = createFakeAuthServer()
    renderWithServer(fetchImpl)

    await user.click(screen.getByRole('button', { name: '가입 실행' }))
    await screen.findByText('결과: signup:true')
    await user.click(screen.getByRole('button', { name: '탈퇴 실행' }))

    expect(await screen.findByText('로그아웃 상태')).toBeInTheDocument()
    expect(readStoredUser()).toBeNull()
    expect(readStoredToken()).toBeNull()
  })

  it('throws when useAuth is used outside of an AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within an AuthProvider')
    consoleError.mockRestore()
  })
})
