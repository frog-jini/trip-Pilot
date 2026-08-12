// /signup 화면 테스트. 폼 검증(비밀번호 확인 불일치 등)과 가입 성공 시 세션이 저장되는지 확인한다.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SignupPage } from './SignupPage'
import { AuthProvider } from '../context/AuthContext'
import { readStoredUser } from '../lib/authStorage'
import { createFakeAuthServer } from '../test/fakeAuthServer'

function renderSignupPage(fetchImpl: typeof fetch) {
  return render(
    <MemoryRouter>
      <AuthProvider fetchImpl={fetchImpl}>
        <SignupPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('SignupPage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('renders the signup heading and form', () => {
    renderSignupPage(createFakeAuthServer().fetchImpl)

    expect(screen.getByRole('heading', { name: '회원가입' })).toBeInTheDocument()
    expect(screen.getByLabelText('이메일')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호 확인')).toBeInTheDocument()
  })

  it('links to the login page', () => {
    renderSignupPage(createFakeAuthServer().fetchImpl)
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login')
  })

  it('persists the session when a valid signup is submitted', async () => {
    const user = userEvent.setup()
    renderSignupPage(createFakeAuthServer().fetchImpl)

    await user.type(screen.getByLabelText('이메일'), 'user@example.com')
    await user.type(screen.getByLabelText('비밀번호'), 'password1')
    await user.type(screen.getByLabelText('비밀번호 확인'), 'password1')
    await user.click(screen.getByRole('button', { name: '회원가입' }))

    await waitFor(() => expect(readStoredUser()).toMatchObject({ email: 'user@example.com' }))
  })

  it('shows an error and does not sign in when the email is already registered', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    server.users.set('user@example.com', { id: '1', email: 'user@example.com', password: 'password1' })
    renderSignupPage(server.fetchImpl)

    await user.type(screen.getByLabelText('이메일'), 'user@example.com')
    await user.type(screen.getByLabelText('비밀번호'), 'password2')
    await user.type(screen.getByLabelText('비밀번호 확인'), 'password2')
    await user.click(screen.getByRole('button', { name: '회원가입' }))

    expect(await screen.findByText('이미 가입된 이메일이에요. 로그인해주세요.')).toBeInTheDocument()
    expect(readStoredUser()).toBeNull()
  })

  it('flags an already-registered email as soon as the field loses focus', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    server.users.set('user@example.com', { id: '1', email: 'user@example.com', password: 'password1' })
    renderSignupPage(server.fetchImpl)

    await user.type(screen.getByLabelText('이메일'), 'user@example.com')
    await user.tab()

    expect(await screen.findByText('이미 가입된 이메일이에요.')).toBeInTheDocument()
  })

  it('signs up with a demo account when the Google button is clicked', async () => {
    const user = userEvent.setup()
    renderSignupPage(createFakeAuthServer().fetchImpl)

    await user.click(screen.getByRole('button', { name: /Google로 계속하기/ }))

    await waitFor(() => expect(readStoredUser()).toMatchObject({ email: 'demo-google@trippilot.app' }))
  })

  it('signs up with a demo account when the Kakao button is clicked', async () => {
    const user = userEvent.setup()
    renderSignupPage(createFakeAuthServer().fetchImpl)

    await user.click(screen.getByRole('button', { name: /Kakao로 계속하기/ }))

    await waitFor(() => expect(readStoredUser()).toMatchObject({ email: 'demo-kakao@trippilot.app' }))
  })
})
