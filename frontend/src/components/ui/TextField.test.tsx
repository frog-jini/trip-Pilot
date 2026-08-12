// TextField는 제어 컴포넌트라 value/onChange를 직접 넘겨야 해서, 테스트용 래퍼로 상태를
// 들고 있는 ControlledTextField를 만들어 실제 사용 방식과 동일하게 렌더링한다.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { TextField } from './TextField'

function ControlledTextField(props: Partial<React.ComponentProps<typeof TextField>>) {
  const [value, setValue] = useState('')
  return (
    <TextField
      label="이메일"
      name="email"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      {...props}
    />
  )
}

describe('TextField', () => {
  it('associates the label with the input', () => {
    render(<ControlledTextField />)
    expect(screen.getByLabelText('이메일')).toBeInTheDocument()
  })

  it('calls onChange and reflects typed input', async () => {
    const user = userEvent.setup()
    render(<ControlledTextField />)

    const input = screen.getByLabelText('이메일')
    await user.type(input, 'user@example.com')

    expect(input).toHaveValue('user@example.com')
  })

  it('renders as a password field when type="password"', () => {
    render(<ControlledTextField label="비밀번호" name="password" type="password" />)
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('type', 'password')
  })

  it('shows an error message and marks the field invalid', () => {
    render(<ControlledTextField error="이메일을 입력해주세요." />)

    const input = screen.getByLabelText('이메일')
    expect(screen.getByText('이메일을 입력해주세요.')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('does not render an error message when there is no error', () => {
    render(<ControlledTextField />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
