// LoginForm.test.tsx와 같은 구조 — 비밀번호 길이/일치 검증까지만 이 컴포넌트 책임이고,
// 실제 가입 API 호출은 onSubmit을 통해 상위(AuthContext)로 위임된다.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignupForm } from './SignupForm'

describe('SignupForm', () => {
  it('renders email, password, and password confirm fields', () => {
    render(<SignupForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('이메일')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호 확인')).toBeInTheDocument()
  })

  it('shows a password length error for a short password', async () => {
    const user = userEvent.setup()
    render(<SignupForm onSubmit={vi.fn()} />)

    await user.type(screen.getByLabelText('이메일'), 'user@example.com')
    await user.type(screen.getByLabelText('비밀번호'), 'short1')
    await user.type(screen.getByLabelText('비밀번호 확인'), 'short1')
    await user.click(screen.getByRole('button', { name: '회원가입' }))

    expect(await screen.findByText('비밀번호는 8자 이상이어야 해요.')).toBeInTheDocument()
  })

  it('shows a mismatch error when passwords differ', async () => {
    const user = userEvent.setup()
    render(<SignupForm onSubmit={vi.fn()} />)

    await user.type(screen.getByLabelText('이메일'), 'user@example.com')
    await user.type(screen.getByLabelText('비밀번호'), 'password1')
    await user.type(screen.getByLabelText('비밀번호 확인'), 'password2')
    await user.click(screen.getByRole('button', { name: '회원가입' }))

    expect(await screen.findByText('비밀번호가 일치하지 않아요.')).toBeInTheDocument()
  })

  it('shows an inline error when the email is already taken, checked on blur', async () => {
    const user = userEvent.setup()
    const onCheckEmail = vi.fn().mockResolvedValue(false)
    render(<SignupForm onSubmit={vi.fn()} onCheckEmail={onCheckEmail} />)

    await user.type(screen.getByLabelText('이메일'), 'taken@example.com')
    await user.tab()

    expect(onCheckEmail).toHaveBeenCalledWith('taken@example.com')
    expect(await screen.findByText('이미 가입된 이메일이에요.')).toBeInTheDocument()
  })

  it('does not check an incomplete email on blur', async () => {
    const user = userEvent.setup()
    const onCheckEmail = vi.fn().mockResolvedValue(false)
    render(<SignupForm onSubmit={vi.fn()} onCheckEmail={onCheckEmail} />)

    await user.type(screen.getByLabelText('이메일'), 'not-an-email')
    await user.tab()

    expect(onCheckEmail).not.toHaveBeenCalled()
  })

  it('clears the taken-email error once the email becomes available', async () => {
    const user = userEvent.setup()
    const onCheckEmail = vi.fn().mockResolvedValue(true)
    render(<SignupForm onSubmit={vi.fn()} onCheckEmail={onCheckEmail} />)

    await user.type(screen.getByLabelText('이메일'), 'free@example.com')
    await user.tab()

    await waitFor(() => expect(screen.getByLabelText('이메일')).not.toHaveAttribute('aria-invalid'))
    expect(screen.queryByText('이미 가입된 이메일이에요.')).not.toBeInTheDocument()
  })

  it('calls onSubmit with the entered values when the form is valid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<SignupForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('이메일'), 'user@example.com')
    await user.type(screen.getByLabelText('비밀번호'), 'password1')
    await user.type(screen.getByLabelText('비밀번호 확인'), 'password1')
    await user.click(screen.getByRole('button', { name: '회원가입' }))

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password1',
      passwordConfirm: 'password1',
    })
  })
})
