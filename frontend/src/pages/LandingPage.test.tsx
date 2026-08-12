// / (랜딩) 화면 스모크 테스트. 섹션 내용은 각 컴포넌트(Hero, FeatureSection 등) 테스트가
// 개별로 검증하므로, 여기서는 페이지가 조립됐을 때 헤드라인과 헤더/푸터가 뜨는지만 확인한다.
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LandingPage } from './LandingPage'
import { AuthProvider } from '../context/AuthContext'

function renderLandingPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LandingPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('LandingPage', () => {
  it('renders the main headline', () => {
    renderLandingPage()
    expect(
      screen.getByRole('heading', { level: 1, name: /AI가 완성하는 나만의 여행 일정/ }),
    ).toBeInTheDocument()
  })

  it('renders header navigation and footer brand', () => {
    renderLandingPage()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })
})
