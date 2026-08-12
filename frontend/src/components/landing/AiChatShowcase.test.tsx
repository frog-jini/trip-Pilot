// 랜딩 페이지의 AI 채팅 쇼케이스(정적 데모 대화)가 헤더 앵커와 맞물리는지,
// 예시 대화 문구와 실제 채팅 화면으로의 링크가 올바른지 검증한다.
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AiChatShowcase } from './AiChatShowcase'

function renderShowcase() {
  return render(
    <MemoryRouter>
      <AiChatShowcase />
    </MemoryRouter>,
  )
}

describe('AiChatShowcase', () => {
  it('has an id matching the header nav anchor', () => {
    const { container } = renderShowcase()
    expect(container.querySelector('#ai-chat')).toBeInTheDocument()
  })

  it('shows the user message about rain', () => {
    renderShowcase()
    expect(screen.getByText(/둘째 날은 비가 올 것 같아/)).toBeInTheDocument()
  })

  it("shows the AI's adjusted itinerary response", () => {
    renderShowcase()
    expect(
      screen.getByText(/실외 관광 대신 쇼핑몰과 실내 관광 위주로 변경하겠습니다/),
    ).toBeInTheDocument()
  })

  it('links to the conversational plan-building chat', () => {
    renderShowcase()
    expect(screen.getByRole('link', { name: 'AI 채팅 사용해보기' })).toHaveAttribute('href', '/plan/chat')
  })
})
