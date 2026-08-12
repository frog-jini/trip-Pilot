// buttonClasses(Link 등 다른 요소가 버튼 스타일만 재사용할 때 씀)와 Button 컴포넌트 자체
// (href 유무에 따라 <a>/<button>로 분기, variant/disabled 처리)를 함께 검증한다.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'
import { buttonClasses } from './buttonStyles'

describe('buttonClasses', () => {
  it('includes the variant and size classes so Link components can reuse Button styling', () => {
    const classes = buttonClasses('accent', 'lg', 'w-full')
    expect(classes).toContain('bg-accent-500')
    expect(classes).toContain('px-6')
    expect(classes).toContain('w-full')
  })
})

describe('Button', () => {
  it('renders its label', () => {
    render(<Button>일정 만들기</Button>)
    expect(screen.getByRole('button', { name: '일정 만들기' })).toBeInTheDocument()
  })

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>클릭</Button>)

    await user.click(screen.getByRole('button', { name: '클릭' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick when disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        비활성
      </Button>,
    )

    await user.click(screen.getByRole('button', { name: '비활성' }))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('applies primary variant styles by default', () => {
    render(<Button>기본</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-primary-600')
  })

  it('applies accent variant styles when variant="accent"', () => {
    render(<Button variant="accent">강조</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-accent-500')
  })

  it('applies outline variant styles when variant="outline"', () => {
    render(<Button variant="outline">아웃라인</Button>)
    expect(screen.getByRole('button')).toHaveClass('border-primary-600')
  })

  it('renders as an anchor tag when href is provided', () => {
    render(<Button href="/signup">회원가입</Button>)
    const link = screen.getByRole('link', { name: '회원가입' })
    expect(link).toHaveAttribute('href', '/signup')
  })
})
