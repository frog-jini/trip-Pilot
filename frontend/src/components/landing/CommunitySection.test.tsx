// 랜딩 페이지의 커뮤니티 미리보기 섹션 — 실제 백엔드 커뮤니티 API(가짜 서버로 대체)에서
// 좋아요순 상위 3개만 골라 보여주는지, 좋아요가 아직 없는 새 게시글은 노출되지 않는지 검증한다.
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CommunitySection } from './CommunitySection'
import { AuthProvider } from '../../context/AuthContext'
import { createFakeApiServer } from '../../test/fakeApiServer'
import { generatePlan } from '../../lib/generatePlan'
import { emptyTripPlanFormValues, type TripPlanFormValues } from '../../lib/tripPlan'

function values(destination: string): TripPlanFormValues {
  return { ...emptyTripPlanFormValues, destination, duration: '2박 3일', styles: ['맛집 중심'] }
}

function seedTrips() {
  return [
    { id: 'a', author: '민지', tag: '힐링 여행', likes: 5, views: 100, itinerary: generatePlan(values('제주')) },
    { id: 'b', author: '현우', tag: '쇼핑 중심', likes: 40, views: 400, itinerary: generatePlan(values('도쿄')) },
    { id: 'c', author: '수진', tag: '가족 여행', likes: 20, views: 200, itinerary: generatePlan(values('방콕')) },
    { id: 'd', author: '지훈', tag: '커플 여행', likes: 10, views: 150, itinerary: generatePlan(values('파리')) },
  ]
}

function renderCommunitySection(fetchImpl?: typeof fetch) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <CommunitySection fetchImpl={fetchImpl} />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('CommunitySection', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('has an id matching the header nav anchor', () => {
    const { container } = renderCommunitySection()
    expect(container.querySelector('#community')).toBeInTheDocument()
  })

  it('renders real community trips with like and view counts', async () => {
    const server = createFakeApiServer({ communityTrips: seedTrips() })
    renderCommunitySection(server.fetchImpl)

    expect((await screen.findAllByText(/좋아요/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/조회/).length).toBeGreaterThan(0)
  })

  it('links "여행 코스 더 보기" to the full community page', () => {
    renderCommunitySection()
    expect(screen.getByRole('link', { name: '여행 코스 더 보기' })).toHaveAttribute('href', '/community')
  })

  it('shows only the top 3 trips, ranked by likes, most-liked first', async () => {
    const server = createFakeApiServer({ communityTrips: seedTrips() })
    renderCommunitySection(server.fetchImpl)

    const links = await screen.findAllByRole('link', { name: /일정 보기/ })
    expect(links).toHaveLength(3)
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      '도쿄 일정 보기',
      '방콕 일정 보기',
      '파리 일정 보기',
    ])
  })

  it('does not show a newly published trip in the preview yet — it starts with no likes', async () => {
    const server = createFakeApiServer({ communityTrips: seedTrips() })
    renderCommunitySection(server.fetchImpl)

    await screen.findAllByRole('link', { name: /일정 보기/ })
    expect(screen.queryByRole('link', { name: '제주 일정 보기' })).not.toBeInTheDocument()
  })
})
