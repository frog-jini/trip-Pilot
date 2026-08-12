// Card가 children을 그대로 렌더링하고, 기본 스타일에 className을 덮어쓰는 게 아니라 병합하는지 확인.
import { render, screen } from '@testing-library/react'
import { Card } from './Card'

describe('Card', () => {
  it('renders its children', () => {
    render(
      <Card>
        <p>카드 내용</p>
      </Card>,
    )
    expect(screen.getByText('카드 내용')).toBeInTheDocument()
  })

  it('applies base surface styling', () => {
    render(<Card data-testid="card">내용</Card>)
    expect(screen.getByTestId('card')).toHaveClass('rounded-2xl', 'border')
  })

  it('merges extra className with the base styling', () => {
    render(
      <Card data-testid="card" className="text-center">
        내용
      </Card>,
    )
    expect(screen.getByTestId('card')).toHaveClass('rounded-2xl', 'text-center')
  })
})
