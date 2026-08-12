// Badge의 tone별 배경색 클래스가 제대로 붙는지만 확인하는 단순 렌더링 테스트.
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge>인기</Badge>)
    expect(screen.getByText('인기')).toBeInTheDocument()
  })

  it('applies neutral tone styles by default', () => {
    render(<Badge>기본</Badge>)
    expect(screen.getByText('기본')).toHaveClass('bg-slate-100')
  })

  it('applies ai tone styles when tone="ai"', () => {
    render(<Badge tone="ai">AI 추천</Badge>)
    expect(screen.getByText('AI 추천')).toHaveClass('bg-ai-100')
  })

  it('applies accent tone styles when tone="accent"', () => {
    render(<Badge tone="accent">신규</Badge>)
    expect(screen.getByText('신규')).toHaveClass('bg-accent-100')
  })
})
