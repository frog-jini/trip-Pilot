// /login 화면 테스트. 이메일/비밀번호 로그인 성공·실패와, 소셜 로그인 버튼이 실제로는
// 고정 비밀번호의 데모 계정으로 로그인하는 것뿐이라는 점(fakeAuthServer)까지 함께 확인한다.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import { AuthProvider } from '../context/AuthContext'
import { LanguageProvider } from '../context/LanguageContext'
import { readStoredUser } from '../lib/authStorage'
import { writeStoredLanguage } from '../lib/i18n/languageStorage'
import { createFakeAuthServer } from '../test/fakeAuthServer'

function renderLoginPage(fetchImpl: typeof fetch) {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <AuthProvider fetchImpl={fetchImpl}>
          <LoginPage />
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('renders the login heading and form', () => {
    renderLoginPage(createFakeAuthServer().fetchImpl)

    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument()
    expect(screen.getByLabelText('이메일')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Google로 계속하기/ })).toBeInTheDocument()
  })

  it('links to the signup page', () => {
    renderLoginPage(createFakeAuthServer().fetchImpl)
    expect(screen.getByRole('link', { name: '회원가입' })).toHaveAttribute('href', '/signup')
  })

  it('persists the session when a valid login is submitted', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    server.users.set('user@example.com', { id: '1', email: 'user@example.com', password: 'password1' })
    renderLoginPage(server.fetchImpl)

    await user.type(screen.getByLabelText('이메일'), 'user@example.com')
    await user.type(screen.getByLabelText('비밀번호'), 'password1')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    await waitFor(() => expect(readStoredUser()).toMatchObject({ email: 'user@example.com' }))
  })

  it('shows an error and does not sign in when the password is wrong', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    server.users.set('user@example.com', { id: '1', email: 'user@example.com', password: 'password1' })
    renderLoginPage(server.fetchImpl)

    await user.type(screen.getByLabelText('이메일'), 'user@example.com')
    await user.type(screen.getByLabelText('비밀번호'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByText('이메일 또는 비밀번호가 올바르지 않아요.')).toBeInTheDocument()
    expect(readStoredUser()).toBeNull()
  })

  it('logs in with a demo account when the Google button is clicked', async () => {
    const user = userEvent.setup()
    renderLoginPage(createFakeAuthServer().fetchImpl)

    await user.click(screen.getByRole('button', { name: /Google로 계속하기/ }))

    await waitFor(() => expect(readStoredUser()).toMatchObject({ email: 'demo-google@trippilot.app' }))
  })

  it('logs in with a demo account when the Kakao button is clicked', async () => {
    const user = userEvent.setup()
    renderLoginPage(createFakeAuthServer().fetchImpl)

    await user.click(screen.getByRole('button', { name: /Kakao로 계속하기/ }))

    await waitFor(() => expect(readStoredUser()).toMatchObject({ email: 'demo-kakao@trippilot.app' }))
  })

  it('renders in English when the language is set to en', () => {
    writeStoredLanguage('en')
    renderLoginPage(createFakeAuthServer().fetchImpl)

    expect(screen.getByRole('heading', { name: 'Log In' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
  })

  it('shows the localized invalid-credentials error in Japanese', async () => {
    writeStoredLanguage('ja')
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    server.users.set('user@example.com', { id: '1', email: 'user@example.com', password: 'password1' })
    renderLoginPage(server.fetchImpl)

    await user.type(screen.getByLabelText('メールアドレス'), 'user@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(await screen.findByText('メールアドレスまたはパスワードが正しくありません。')).toBeInTheDocument()
  })
})
