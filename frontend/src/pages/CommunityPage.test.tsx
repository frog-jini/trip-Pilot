// /community 목록 화면 테스트. fakeApiServer의 seed 데이터로 좋아요순 정렬, 좋아요 토글,
// 조회수 표시, 그리고 로그인한 사용자가 직접 공유한 일정까지 목록에 함께 뜨는지 확인한다.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CommunityPage } from './CommunityPage'
import { AuthProvider } from '../context/AuthContext'
import { writeStoredToken, writeStoredUser } from '../lib/authStorage'
import { createFakeApiServer } from '../test/fakeApiServer'
import { generatePlan } from '../lib/generatePlan'
import { emptyTripPlanFormValues, type TripPlanFormValues } from '../lib/tripPlan'

const seoulValues: TripPlanFormValues = {
  ...emptyTripPlanFormValues,
  destination: '서울',
  duration: '2박 3일',
  styles: ['맛집 중심'],
}

const tokyoValues: TripPlanFormValues = {
  ...emptyTripPlanFormValues,
  destination: '일본 도쿄',
  duration: '3박 4일',
  styles: ['쇼핑 중심'],
}

function seedTrips() {
  return [
    { id: 'seoul-trip', author: '민지', tag: '맛집 중심', likes: 5, views: 100, itinerary: generatePlan(seoulValues) },
    { id: 'tokyo-trip', author: '현우', tag: '쇼핑 중심', likes: 20, views: 400, itinerary: generatePlan(tokyoValues) },
  ]
}

function signIn(id = '1', email = 'user@example.com') {
  writeStoredUser({ id, email })
  writeStoredToken(id)
}

function renderCommunityPage(fetchImpl?: typeof fetch) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <CommunityPage fetchImpl={fetchImpl} />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('CommunityPage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('renders a heading', () => {
    renderCommunityPage()
    expect(screen.getByRole('heading', { level: 1, name: '커뮤니티' })).toBeInTheDocument()
  })

  it('lists every community trip with a link to its detail page, most-liked first', async () => {
    const server = createFakeApiServer({ communityTrips: seedTrips() })
    renderCommunityPage(server.fetchImpl)

    const links = await screen.findAllByRole('link', { name: /일정 보기/ })
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      '일본 도쿄 일정 보기',
      '서울 일정 보기',
    ])
  })

  it('lets a signed-in user like a trip', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer({ communityTrips: seedTrips() })
    renderCommunityPage(server.fetchImpl)

    const likeButtons = await screen.findAllByRole('button', { name: /좋아요/ })
    await user.click(likeButtons[0])

    expect(await screen.findByText('❤ 좋아요 21')).toBeInTheDocument()
  })

  it('shows view counts from the server', async () => {
    const server = createFakeApiServer({ communityTrips: seedTrips() })
    renderCommunityPage(server.fetchImpl)

    expect(await screen.findByText('조회 400')).toBeInTheDocument()
    expect(screen.getByText('조회 100')).toBeInTheDocument()
  })

  it('shows a trip a user has published from their own saved itinerary', async () => {
    const server = createFakeApiServer()
    server.trips.set('trip-1', {
      id: 'trip-1',
      userId: '1',
      itinerary: generatePlan(seoulValues),
      formValues: seoulValues,
      history: {},
      costs: {},
      times: {},
      createdAt: new Date().toISOString(),
    })
    server.communityTrips.set('community-1', {
      id: 'community-1',
      userId: '1',
      sourceTripId: 'trip-1',
      author: 'me@example.com',
      tag: '맛집 중심',
      itinerary: generatePlan(seoulValues),
      baseLikes: 0,
      likedBy: new Set(),
      views: 0,
    })

    renderCommunityPage(server.fetchImpl)

    expect(await screen.findByRole('link', { name: '서울 일정 보기' })).toHaveAttribute(
      'href',
      '/community/community-1',
    )
    expect(screen.getByText('by me@example.com')).toBeInTheDocument()
  })
})
