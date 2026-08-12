// /community/:tripId 상세 화면 테스트. StrictMode로 한 번 더 렌더링해서, effect가 두 번
// 실행되더라도 조회수가 중복으로 올라가지 않는지까지 확인한다(renderAtStrict).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CommunityTripDetailPage } from './CommunityTripDetailPage'
import { AuthProvider } from '../context/AuthContext'
import { LanguageProvider } from '../context/LanguageContext'
import { writeStoredToken, writeStoredUser } from '../lib/authStorage'
import { writeStoredLanguage } from '../lib/i18n/languageStorage'
import { createFakeApiServer } from '../test/fakeApiServer'

function seedTrip() {
  return {
    id: 'tokyo-trip',
    author: '현우',
    tag: '맛집 중심',
    likes: 5,
    views: 100,
    itinerary: {
      destination: '일본 도쿄',
      duration: '2박 3일',
      travelers: 2,
      budget: 100,
      days: [
        { day: 1, title: '1일차', activities: ['아사쿠사 관광', '스카이트리 전망대'] },
        { day: 2, title: '2일차', activities: ['츠키지 시장 아침', '긴자 백화점 쇼핑'] },
      ],
    },
  }
}

function signIn(id = '1', email = 'user@example.com') {
  writeStoredUser({ id, email })
  writeStoredToken(id)
}

function renderAt(path: string, fetchImpl?: typeof fetch) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <AuthProvider>
          <Routes>
            <Route path="/community/:tripId" element={<CommunityTripDetailPage fetchImpl={fetchImpl} />} />
            <Route path="/community" element={<div>목록 페이지</div>} />
          </Routes>
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>,
  )
}

function renderAtStrict(path: string, fetchImpl?: typeof fetch) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <Routes>
            <Route path="/community/:tripId" element={<CommunityTripDetailPage fetchImpl={fetchImpl} />} />
            <Route path="/community" element={<div>목록 페이지</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </StrictMode>,
  )
}

describe('CommunityTripDetailPage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it("renders the matching trip's author, destination, and every activity", async () => {
    const trip = seedTrip()
    const server = createFakeApiServer({ communityTrips: [trip] })
    renderAt(`/community/${trip.id}`, server.fetchImpl)

    expect(await screen.findByText(new RegExp(trip.author))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(trip.itinerary.destination))).toBeInTheDocument()
    for (const activity of trip.itinerary.days[0].activities) {
      expect(screen.getByText(activity)).toBeInTheDocument()
    }
  })

  it('translates the community demo activity phrases when the language is English', async () => {
    writeStoredLanguage('en')
    const trip = seedTrip()
    const server = createFakeApiServer({ communityTrips: [trip] })
    renderAt(`/community/${trip.id}`, server.fetchImpl)

    expect(await screen.findByText('Asakusa Sightseeing')).toBeInTheDocument()
    expect(screen.getByText('Skytree Observation Deck')).toBeInTheDocument()
    expect(screen.queryByText('아사쿠사 관광')).not.toBeInTheDocument()
  })

  it('does not render delete buttons since this is someone else’s trip', async () => {
    const trip = seedTrip()
    const server = createFakeApiServer({ communityTrips: [trip] })
    renderAt(`/community/${trip.id}`, server.fetchImpl)

    await screen.findByText(new RegExp(trip.itinerary.destination))
    expect(screen.queryByRole('button', { name: /삭제/ })).not.toBeInTheDocument()
  })

  it('lets me favorite a place from someone else’s itinerary', async () => {
    const user = userEvent.setup()
    signIn()
    const trip = seedTrip()
    const server = createFakeApiServer({ communityTrips: [trip] })
    const activity = trip.itinerary.days[0].activities[0]
    renderAt(`/community/${trip.id}`, server.fetchImpl)

    await user.click(await screen.findByRole('button', { name: `${activity} 즐겨찾기 추가` }))

    expect(await screen.findByRole('button', { name: `${activity} 즐겨찾기 해제` })).toBeInTheDocument()
    expect([...server.favorites.values()]).toContainEqual(
      expect.objectContaining({ destination: trip.itinerary.destination, activity }),
    )
  })

  it('lets a signed-in user like the trip', async () => {
    const user = userEvent.setup()
    signIn()
    const trip = seedTrip()
    const server = createFakeApiServer({ communityTrips: [trip] })
    renderAt(`/community/${trip.id}`, server.fetchImpl)

    await user.click(await screen.findByRole('button', { name: /좋아요/ }))

    expect(await screen.findByText(`❤ 좋아요 ${trip.likes + 1}`)).toBeInTheDocument()
  })

  it('records a view for future visitors but keeps showing this viewer the count the list already showed', async () => {
    const trip = seedTrip()
    const server = createFakeApiServer({ communityTrips: [trip] })
    renderAt(`/community/${trip.id}`, server.fetchImpl)

    // Matches what the community list/preview just showed — not bumped by this very visit.
    expect(await screen.findByText(`조회 ${trip.views}`)).toBeInTheDocument()
    // The view is still persisted, so the next visitor (or the list on next load) sees it.
    expect(server.communityTrips.get(trip.id)?.views).toBe(trip.views + 1)
  })

  it('records exactly one view per visit, even under React StrictMode', async () => {
    const trip = seedTrip()
    const server = createFakeApiServer({ communityTrips: [trip] })
    renderAtStrict(`/community/${trip.id}`, server.fetchImpl)

    await screen.findByText(new RegExp(trip.itinerary.destination))
    expect(server.communityTrips.get(trip.id)?.views).toBe(trip.views + 1)
  })

  it('shows a not-found message with a link back to the community list for an unknown id', async () => {
    const server = createFakeApiServer()
    renderAt('/community/does-not-exist', server.fetchImpl)

    expect(await screen.findByText('해당 커뮤니티 일정을 찾을 수 없어요.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '커뮤니티로 돌아가기' })).toHaveAttribute('href', '/community')
  })
})
