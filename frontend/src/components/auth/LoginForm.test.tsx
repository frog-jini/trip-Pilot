// LoginForm은 실제 로그인 API를 모르고 검증까지만 하고 onSubmit으로 위임하므로,
// 여기서도 API 호출 없이 검증/제출 콜백 동작만 확인한다.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './LoginForm'

describe('LoginForm', () => {
  it('renders email and password fields', () => {
    render(<LoginForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('이메일')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
  })

  it('shows validation errors and does not submit when fields are empty', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByText('이메일을 입력해주세요.')).toBeInTheDocument()
    expect(screen.getByText('비밀번호를 입력해주세요.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows an email format error for an invalid email', async () => {
    const user = userEvent.setup()
    render(<LoginForm onSubmit={vi.fn()} />)

    await user.type(screen.getByLabelText('이메일'), 'not-an-email')
    await user.type(screen.getByLabelText('비밀번호'), 'password1')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByText('올바른 이메일 형식이 아니에요.')).toBeInTheDocument()
  })

  it('calls onSubmit with the entered credentials when the form is valid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('이메일'), 'user@example.com')
    await user.type(screen.getByLabelText('비밀번호'), 'password1')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(onSubmit).toHaveBeenCalledWith({ email: 'user@example.com', password: 'password1' })
  })
})
