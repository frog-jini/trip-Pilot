// 커뮤니티 목록의 카드 하나가 데이터를 올바르게 보여주고, 좋아요 클릭 시 상위로 trip id를
// 넘겨주는지만 확인한다 — 실제 좋아요 API 호출/조회수 로직은 CommunityPage/CommunityTripDetailPage 쪽 책임.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CommunityTripCard } from './CommunityTripCard'
import { LanguageProvider } from '../../context/LanguageContext'
import { writeStoredLanguage } from '../../lib/i18n/languageStorage'
import type { CommunityTrip } from '../../lib/communityTrips'

function buildTrip(overrides: Partial<CommunityTrip> = {}): CommunityTrip {
  return {
    id: 'jeju-healing',
    author: '민지',
    tag: '힐링 여행',
    likes: 128,
    views: 3200,
    liked: false,
    itinerary: {
      destination: '제주',
      duration: '2박 3일',
      travelers: 2,
      budget: 60,
      days: [{ day: 1, title: '1일차', activities: ['성산일출봉 일출 감상'] }],
    },
    ...overrides,
  }
}

function renderCard(trip: CommunityTrip, onToggleLike = vi.fn()) {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <CommunityTripCard trip={trip} onToggleLike={onToggleLike} />
      </LanguageProvider>
    </MemoryRouter>,
  )
}

describe('CommunityTripCard', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('renders the destination, duration, author, and tag', () => {
    renderCard(buildTrip())
    expect(screen.getByText(/제주/)).toBeInTheDocument()
    expect(screen.getByText(/2박 3일/)).toBeInTheDocument()
    expect(screen.getByText(/민지/)).toBeInTheDocument()
    expect(screen.getByText('힐링 여행')).toBeInTheDocument()
  })

  it('renders the view count', () => {
    renderCard(buildTrip())
    expect(screen.getByText(/3200/)).toBeInTheDocument()
  })

  it('shows the like count and pressed state when not liked by me', () => {
    renderCard(buildTrip({ liked: false, likes: 128 }))
    const button = screen.getByRole('button', { name: /좋아요/ })
    expect(button).toHaveTextContent('128')
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the like count and pressed state when liked by me', () => {
    renderCard(buildTrip({ liked: true, likes: 129 }))
    const button = screen.getByRole('button', { name: /좋아요/ })
    expect(button).toHaveTextContent('129')
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onToggleLike with the trip id when the like button is clicked', async () => {
    const user = userEvent.setup()
    const onToggleLike = vi.fn()
    renderCard(buildTrip(), onToggleLike)

    await user.click(screen.getByRole('button', { name: /좋아요/ }))

    expect(onToggleLike).toHaveBeenCalledWith('jeju-healing')
  })

  it('links to the trip detail page', () => {
    renderCard(buildTrip())
    expect(screen.getByRole('link', { name: /일정 보기/ })).toHaveAttribute(
      'href',
      '/community/jeju-healing',
    )
  })

  it('translates the duration and catalog activity when the language is Japanese', () => {
    writeStoredLanguage('ja')
    renderCard(buildTrip())
    expect(screen.getByText(/2泊3日/)).toBeInTheDocument()
  })
})
