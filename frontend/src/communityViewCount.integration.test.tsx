// 조회수가 랜딩 미리보기 → 커뮤니티 목록 → 상세 페이지까지 여러 화면에 걸쳐 일관되게 보이는지,
// 그리고 "본인 방문"으로는 중복 집계되지 않는지를 실제 라우팅과 함께 통합 검증한다
// (개별 페이지 단위 테스트로는 화면 간 불일치를 잡아낼 수 없어서 별도로 둔 파일).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CommunitySection } from './components/landing/CommunitySection'
import { CommunityPage } from './pages/CommunityPage'
import { CommunityTripDetailPage } from './pages/CommunityTripDetailPage'
import { createFakeApiServer } from './test/fakeApiServer'
import { generatePlan } from './lib/generatePlan'
import { emptyTripPlanFormValues, type TripPlanFormValues } from './lib/tripPlan'

const tokyoValues: TripPlanFormValues = {
  ...emptyTripPlanFormValues,
  destination: '일본 도쿄',
  duration: '2박 3일',
  styles: ['맛집 중심'],
}

function seedTrip() {
  return { id: 'tokyo-trip', author: '현우', tag: '맛집 중심', likes: 5, views: 3200, itinerary: generatePlan(tokyoValues) }
}

function renderApp(initialPath: string, fetchImpl?: typeof fetch) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<CommunitySection fetchImpl={fetchImpl} />} />
          <Route path="/community" element={<CommunityPage fetchImpl={fetchImpl} />} />
          <Route path="/community/:tripId" element={<CommunityTripDetailPage fetchImpl={fetchImpl} />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('community view count', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('shows the same number on the detail page that the landing preview just showed', async () => {
    const user = userEvent.setup()
    const trip = seedTrip()
    const server = createFakeApiServer({ communityTrips: [trip] })
    renderApp('/', server.fetchImpl)

    expect(await screen.findByText(`조회 ${trip.views}`)).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: `${trip.itinerary.destination} 일정 보기` }))

    // Opening it is what records the view — it shouldn't also bump the number shown
    // to the very person whose visit is being counted.
    expect(await screen.findByText(`조회 ${trip.views}`)).toBeInTheDocument()
  })

  it('shows the same number on the detail page that the full community list just showed', async () => {
    const user = userEvent.setup()
    const trip = seedTrip()
    const server = createFakeApiServer({ communityTrips: [trip] })
    renderApp('/community', server.fetchImpl)

    expect(await screen.findByText(`조회 ${trip.views}`)).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: `${trip.itinerary.destination} 일정 보기` }))

    expect(await screen.findByText(`조회 ${trip.views}`)).toBeInTheDocument()
  })

  it('still counts the visit for the next person to load the list', async () => {
    const user = userEvent.setup()
    const trip = seedTrip()
    const server = createFakeApiServer({ communityTrips: [trip] })
    const { unmount } = renderApp('/community', server.fetchImpl)

    await user.click(await screen.findByRole('link', { name: `${trip.itinerary.destination} 일정 보기` }))
    await screen.findByText(`조회 ${trip.views}`)
    unmount()

    // A brand-new page load (a different visitor, or this one reopening the browser)
    // fetches fresh from the server and should see the recorded view reflected.
    renderApp('/community', server.fetchImpl)
    expect(await screen.findByText(`조회 ${trip.views + 1}`)).toBeInTheDocument()
  })
})
