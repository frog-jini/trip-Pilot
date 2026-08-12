// 랜딩 페이지에서 /#features 같은 해시 링크로 들어왔을 때 해당 섹션으로 스크롤되는지 검증한다.
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useScrollToHash } from './useScrollToHash'

function TestHarness() {
  useScrollToHash()
  return (
    <div>
      <div id="features">기능 섹션</div>
    </div>
  )
}

describe('useScrollToHash', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('scrolls the matching element into view when the URL has a hash', () => {
    render(
      <MemoryRouter initialEntries={['/#features']}>
        <TestHarness />
      </MemoryRouter>,
    )

    const target = screen.getByText('기능 섹션')
    expect(target.scrollIntoView).toHaveBeenCalled()
  })

  it('does nothing when the URL has no hash', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TestHarness />
      </MemoryRouter>,
    )

    const target = screen.getByText('기능 섹션')
    expect(target.scrollIntoView).not.toHaveBeenCalled()
  })
})
