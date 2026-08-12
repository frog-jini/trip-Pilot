// 로그인/회원가입 공용 껍데기(AuthLayout)가 props로 받은 제목·부제·children·하단 링크를
// 그대로 렌더링하는지만 확인하는 얕은 테스트 — 실제 폼 로직은 LoginForm/SignupForm 쪽에서 검증한다.
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthLayout } from './AuthLayout'

function renderLayout() {
  return render(
    <MemoryRouter>
      <AuthLayout
        title="로그인"
        subtitle="다시 만나 반가워요"
        footerText="아직 계정이 없으신가요?"
        footerLinkText="회원가입"
        footerLinkHref="/signup"
      >
        <p>폼 영역</p>
      </AuthLayout>
    </MemoryRouter>,
  )
}

describe('AuthLayout', () => {
  it('renders the title, subtitle, and children', () => {
    renderLayout()
    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument()
    expect(screen.getByText('다시 만나 반가워요')).toBeInTheDocument()
    expect(screen.getByText('폼 영역')).toBeInTheDocument()
  })

  it('renders a brand link back to the home page', () => {
    renderLayout()
    expect(screen.getByRole('link', { name: /Trailot/ })).toHaveAttribute('href', '/')
  })

  it('renders the footer link to switch between login and signup', () => {
    renderLayout()
    expect(screen.getByText('아직 계정이 없으신가요?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '회원가입' })).toHaveAttribute('href', '/signup')
  })
})
