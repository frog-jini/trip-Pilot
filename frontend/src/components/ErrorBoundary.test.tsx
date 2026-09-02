// ErrorBoundary가 자식 트리에서 던져진 렌더 에러를 잡아 대체 화면을 보여주는지 확인한다.
// React가 개발 모드에서 에러를 콘솔에 추가로 로그하므로, 여기서는 그 노이즈를 막기 위해
// console.error를 잠깐 무음 처리한다(실제 실패 여부는 화면 내용으로만 판단).
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Bomb(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>정상 화면</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('정상 화면')).toBeInTheDocument()
  })

  it('shows a fallback screen instead of a blank page when a child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )

    expect(screen.getByText('문제가 생겼어요. 새로고침해주세요.')).toBeInTheDocument()
    expect(screen.queryByText('정상 화면')).not.toBeInTheDocument()

    consoleError.mockRestore()
  })
})
