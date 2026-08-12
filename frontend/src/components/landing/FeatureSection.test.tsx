// 랜딩 페이지 기능 소개 섹션 — 각 기능 카드가 실제 존재하는 라우트로 정확히 링크되는지
// 검증한다(카드 문구와 실제 화면 경로가 어긋나는 걸 잡아내기 위함).
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FeatureSection } from './FeatureSection'
import { LanguageProvider } from '../../context/LanguageContext'
import { writeStoredLanguage } from '../../lib/i18n/languageStorage'

function renderFeatureSection() {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <FeatureSection />
      </LanguageProvider>
    </MemoryRouter>,
  )
}

describe('FeatureSection', () => {
  it('has an id matching the header nav anchor', () => {
    const { container } = renderFeatureSection()
    expect(container.querySelector('#features')).toBeInTheDocument()
  })

  it('renders every core feature title', () => {
    renderFeatureSection()
    expect(screen.getByText('여행지 검색')).toBeInTheDocument()
    expect(screen.getByText('일정 만들기')).toBeInTheDocument()
    expect(screen.getByText('실시간 일정 수정')).toBeInTheDocument()
    expect(screen.getByText('추천 여행 경로')).toBeInTheDocument()
    expect(screen.getByText('즐겨찾기 & 저장')).toBeInTheDocument()
  })

  it('links each feature card to its real screen', () => {
    renderFeatureSection()
    expect(screen.getByRole('link', { name: /여행지 검색/ })).toHaveAttribute('href', '/destinations')
    expect(screen.getByRole('link', { name: /일정 만들기/ })).toHaveAttribute('href', '/plan/new')
    expect(screen.getByRole('link', { name: /실시간 일정 수정/ })).toHaveAttribute('href', '/trips')
    expect(screen.getByRole('link', { name: /추천 여행 경로/ })).toHaveAttribute('href', '/community')
    expect(screen.getByRole('link', { name: /즐겨찾기 & 저장/ })).toHaveAttribute('href', '/favorites')
  })

  it('renders every feature title in Japanese when the language is set to ja', () => {
    writeStoredLanguage('ja')
    renderFeatureSection()
    expect(screen.getByText('旅行先検索')).toBeInTheDocument()
    expect(screen.getByText('プラン作成')).toBeInTheDocument()
    expect(screen.getByText('リアルタイム編集')).toBeInTheDocument()
    expect(screen.getByText('おすすめルート')).toBeInTheDocument()
    expect(screen.getByText('お気に入り・保存')).toBeInTheDocument()
  })
})
