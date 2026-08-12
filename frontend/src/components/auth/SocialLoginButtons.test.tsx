// 순수 UI 컴포넌트라 실제 OAuth 여부와 무관하게 버튼 클릭 시 각 콜백이 호출되는지만 확인한다.
// 콜백 안에서 실제로 무엇을 하는지(데모 계정 로그인)는 AuthContext 쪽 책임.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SocialLoginButtons } from './SocialLoginButtons'

describe('SocialLoginButtons', () => {
  it('renders Google and Kakao continue buttons', () => {
    render(<SocialLoginButtons />)
    expect(screen.getByRole('button', { name: /Google로 계속하기/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Kakao로 계속하기/ })).toBeInTheDocument()
  })

  it('calls onGoogleClick when the Google button is clicked', async () => {
    const user = userEvent.setup()
    const onGoogleClick = vi.fn()
    render(<SocialLoginButtons onGoogleClick={onGoogleClick} />)

    await user.click(screen.getByRole('button', { name: /Google로 계속하기/ }))

    expect(onGoogleClick).toHaveBeenCalledTimes(1)
  })

  it('calls onKakaoClick when the Kakao button is clicked', async () => {
    const user = userEvent.setup()
    const onKakaoClick = vi.fn()
    render(<SocialLoginButtons onKakaoClick={onKakaoClick} />)

    await user.click(screen.getByRole('button', { name: /Kakao로 계속하기/ }))

    expect(onKakaoClick).toHaveBeenCalledTimes(1)
  })
})
