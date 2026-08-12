// /account 화면 테스트. fakeAuthServer로 실제 백엔드 없이 이메일/비밀번호 변경, 회원 탈퇴
// 흐름을 검증한다. 비로그인 접근 시 안내와 /login 링크가 뜨는 것까지 함께 확인한다.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AccountPage } from './AccountPage'
import { AuthProvider } from '../context/AuthContext'
import { readStoredToken, readStoredUser, writeStoredToken, writeStoredUser } from '../lib/authStorage'
import { createFakeAuthServer, type FakeAuthServer } from '../test/fakeAuthServer'

function renderAt(path: string, fetchImpl: typeof fetch) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider fetchImpl={fetchImpl}>
        <Routes>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/login" element={<div>로그인 페이지</div>} />
          <Route path="/" element={<div>홈 페이지</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function signIn(server: FakeAuthServer, email = 'user@example.com', password = 'password1') {
  server.users.set(email, { id: '1', email, password })
  writeStoredUser({ id: '1', email })
  writeStoredToken('1')
}

describe('AccountPage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('prompts to log in when there is no session', () => {
    renderAt('/account', createFakeAuthServer().fetchImpl)
    expect(screen.getByText('로그인이 필요해요.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '로그인하러 가기' })).toHaveAttribute('href', '/login')
  })

  it('shows the current email pre-filled in the edit field', () => {
    const server = createFakeAuthServer()
    signIn(server)
    renderAt('/account', server.fetchImpl)

    expect(screen.getByLabelText('이메일')).toHaveValue('user@example.com')
  })

  it('updates the email on save', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    signIn(server)
    renderAt('/account', server.fetchImpl)

    const input = screen.getByLabelText('이메일')
    await user.clear(input)
    await user.type(input, 'new@example.com')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('이메일이 변경됐어요.')).toBeInTheDocument()
    expect(readStoredUser()).toMatchObject({ email: 'new@example.com' })
  })

  it('shows an error when the new email is already taken', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    signIn(server)
    server.users.set('taken@example.com', { id: '2', email: 'taken@example.com', password: 'password2' })
    renderAt('/account', server.fetchImpl)

    const input = screen.getByLabelText('이메일')
    await user.clear(input)
    await user.type(input, 'taken@example.com')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('이미 사용 중인 이메일이에요.')).toBeInTheDocument()
  })

  it('renders the password change form', () => {
    const server = createFakeAuthServer()
    signIn(server)
    renderAt('/account', server.fetchImpl)

    expect(screen.getByLabelText('현재 비밀번호')).toBeInTheDocument()
    expect(screen.getByLabelText('새 비밀번호')).toBeInTheDocument()
    expect(screen.getByLabelText('새 비밀번호 확인')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '비밀번호 변경' })).toBeInTheDocument()
  })

  it('changes the password when the current password is correct', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    signIn(server, 'user@example.com', 'oldpassword1')
    renderAt('/account', server.fetchImpl)

    await user.type(screen.getByLabelText('현재 비밀번호'), 'oldpassword1')
    await user.type(screen.getByLabelText('새 비밀번호'), 'newpassword1')
    await user.type(screen.getByLabelText('새 비밀번호 확인'), 'newpassword1')
    await user.click(screen.getByRole('button', { name: '비밀번호 변경' }))

    expect(await screen.findByText('비밀번호가 변경됐어요.')).toBeInTheDocument()
    expect(server.users.get('user@example.com')?.password).toBe('newpassword1')
  })

  it('shows an error when the current password is wrong', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    signIn(server, 'user@example.com', 'oldpassword1')
    renderAt('/account', server.fetchImpl)

    await user.type(screen.getByLabelText('현재 비밀번호'), 'wrongpassword')
    await user.type(screen.getByLabelText('새 비밀번호'), 'newpassword1')
    await user.type(screen.getByLabelText('새 비밀번호 확인'), 'newpassword1')
    await user.click(screen.getByRole('button', { name: '비밀번호 변경' }))

    expect(await screen.findByText('현재 비밀번호가 일치하지 않아요.')).toBeInTheDocument()
    expect(server.users.get('user@example.com')?.password).toBe('oldpassword1')
  })

  it('shows an error when the new password is too short', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    signIn(server, 'user@example.com', 'oldpassword1')
    renderAt('/account', server.fetchImpl)

    await user.type(screen.getByLabelText('현재 비밀번호'), 'oldpassword1')
    await user.type(screen.getByLabelText('새 비밀번호'), 'short')
    await user.type(screen.getByLabelText('새 비밀번호 확인'), 'short')
    await user.click(screen.getByRole('button', { name: '비밀번호 변경' }))

    expect(await screen.findByText('비밀번호는 8자 이상이어야 해요.')).toBeInTheDocument()
    expect(server.users.get('user@example.com')?.password).toBe('oldpassword1')
  })

  it('shows an error when the new password confirmation does not match', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    signIn(server, 'user@example.com', 'oldpassword1')
    renderAt('/account', server.fetchImpl)

    await user.type(screen.getByLabelText('현재 비밀번호'), 'oldpassword1')
    await user.type(screen.getByLabelText('새 비밀번호'), 'newpassword1')
    await user.type(screen.getByLabelText('새 비밀번호 확인'), 'somethingelse1')
    await user.click(screen.getByRole('button', { name: '비밀번호 변경' }))

    expect(await screen.findByText('새 비밀번호가 일치하지 않아요.')).toBeInTheDocument()
    expect(server.users.get('user@example.com')?.password).toBe('oldpassword1')
  })

  it('deletes the account and personal data after confirmation, then goes home', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    signIn(server)
    // Trips and favorites are both cascade-deleted server-side with the account
    // (guaranteed by the schema's ON DELETE CASCADE, exercised by the backend's own tests).

    renderAt('/account', server.fetchImpl)

    await user.click(screen.getByRole('button', { name: '회원 탈퇴' }))
    expect(screen.getByText('정말 탈퇴할까요? 저장된 일정과 즐겨찾기가 모두 삭제돼요.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '탈퇴 확정' }))

    expect(await screen.findByText('홈 페이지')).toBeInTheDocument()
    expect(readStoredUser()).toBeNull()
    expect(readStoredToken()).toBeNull()
    await waitFor(() => expect(server.users.has('user@example.com')).toBe(false))
  })

  it('cancels account deletion without deleting anything', async () => {
    const user = userEvent.setup()
    const server = createFakeAuthServer()
    signIn(server)
    renderAt('/account', server.fetchImpl)

    await user.click(screen.getByRole('button', { name: '회원 탈퇴' }))
    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.queryByText('정말 탈퇴할까요? 저장된 일정과 즐겨찾기가 모두 삭제돼요.')).not.toBeInTheDocument()
    expect(readStoredUser()).toMatchObject({ email: 'user@example.com' })
  })
})
