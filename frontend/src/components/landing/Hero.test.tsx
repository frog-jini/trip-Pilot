// Hero.tsx의 3단계 분기(비로그인/로그인+일정없음/로그인+일정있음)가 각각 올바른 헤드라인·CTA를
// 보여주는지 검증한다. 가짜 트립 서버로 실제 addTrip/조회 흐름까지 거쳐서, "최근 일정"이 실제
// 저장된 마지막 트립을 가리키는지까지 확인한다.
import { render, screen } from '@testing-library/react'
import { Hero } from './Hero'
import { AuthProvider } from '../../context/AuthContext'
import { writeStoredToken, writeStoredUser } from '../../lib/authStorage'
import { createActivityHistory, generatePlan } from '../../lib/generatePlan'
import { addTrip } from '../../lib/tripsStorage'
import { emptyTripPlanFormValues, type TripPlanFormValues } from '../../lib/tripPlan'
import { createFakeTripsServer } from '../../test/fakeTripsServer'

function renderHero(fetchImpl: typeof fetch) {
  return render(
    <AuthProvider>
      <Hero fetchImpl={fetchImpl} />
    </AuthProvider>,
  )
}

function signIn(id = '1', email = 'user@example.com') {
  writeStoredUser({ id, email })
  writeStoredToken(id)
}

async function buildTrip(fetchImpl: typeof fetch, values: TripPlanFormValues) {
  const itinerary = generatePlan(values)
  await addTrip('1', { itinerary, values, history: createActivityHistory(itinerary) }, fetchImpl)
}

describe('Hero', () => {
  afterEach(() => {
    localStorage.clear()
  })

  describe('when logged out', () => {
    it('renders the main marketing headline', () => {
      renderHero(createFakeTripsServer().fetchImpl)
      expect(
        screen.getByRole('heading', { level: 1, name: /AI가 완성하는 나만의 여행 일정/ }),
      ).toBeInTheDocument()
    })

    it('renders a primary CTA to sign up', () => {
      renderHero(createFakeTripsServer().fetchImpl)
      expect(screen.getByRole('link', { name: '무료로 시작하기' })).toHaveAttribute('href', '/signup')
    })

    it('renders a secondary CTA to browse community routes', () => {
      renderHero(createFakeTripsServer().fetchImpl)
      expect(screen.getByRole('link', { name: '추천 여행 코스 둘러보기' })).toHaveAttribute(
        'href',
        '#community',
      )
    })
  })

  describe('when logged in without a saved trip', () => {
    it('invites the user to create their first plan instead of signing up', async () => {
      signIn()
      renderHero(createFakeTripsServer().fetchImpl)

      expect(
        await screen.findByRole('heading', { level: 1, name: '첫 AI 여행 일정을 만들어보세요' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: '일정 만들기' })).toHaveAttribute('href', '/plan/new')
      expect(screen.queryByRole('link', { name: '무료로 시작하기' })).not.toBeInTheDocument()
    })
  })

  describe('when logged in with at least one saved trip', () => {
    it("shows the user's most recent itinerary instead of the sign-up banner", async () => {
      signIn()
      const server = createFakeTripsServer()
      await buildTrip(server.fetchImpl, {
        ...emptyTripPlanFormValues,
        destination: '오사카',
        duration: '1박 2일',
        styles: ['쇼핑 중심'],
      })
      await buildTrip(server.fetchImpl, {
        ...emptyTripPlanFormValues,
        destination: '일본 도쿄',
        duration: '2박 3일',
        styles: ['맛집 중심'],
      })

      renderHero(server.fetchImpl)

      expect(
        await screen.findByRole('heading', { level: 1, name: '내가 만든 여행 일정' }),
      ).toBeInTheDocument()
      expect(screen.getAllByText(/일본 도쿄/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/2박 3일/).length).toBeGreaterThan(0)
      expect(screen.getByRole('link', { name: '내 일정 보기' })).toHaveAttribute('href', '/trips')
      expect(screen.getByRole('link', { name: '새 일정 만들기' })).toHaveAttribute('href', '/plan/new')
      expect(screen.queryByRole('link', { name: '무료로 시작하기' })).not.toBeInTheDocument()
    })
  })
})
