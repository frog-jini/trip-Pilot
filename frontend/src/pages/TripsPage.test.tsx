// /trips 목록 화면 테스트. 저장된 일정 카드 표시와 삭제(확인 절차 포함)가 fakeTripsServer에
// 반영되는지 확인한다.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TripsPage } from './TripsPage'
import { AuthProvider } from '../context/AuthContext'
import { LanguageProvider } from '../context/LanguageContext'
import { writeStoredToken, writeStoredUser } from '../lib/authStorage'
import { writeStoredLanguage } from '../lib/i18n/languageStorage'
import { createActivityHistory, generatePlan } from '../lib/generatePlan'
import { addTrip } from '../lib/tripsStorage'
import { emptyTripPlanFormValues, type TripPlanFormValues } from '../lib/tripPlan'
import { createFakeTripsServer } from '../test/fakeTripsServer'

function signIn(id = '1', email = 'user@example.com') {
  writeStoredUser({ id, email })
  writeStoredToken(id)
}

async function buildTrip(fetchImpl: typeof fetch, values: TripPlanFormValues) {
  const itinerary = generatePlan(values)
  return addTrip('1', { itinerary, values, history: createActivityHistory(itinerary) }, fetchImpl)
}

function renderTripsPage(fetchImpl: typeof fetch) {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <AuthProvider fetchImpl={fetchImpl}>
          <TripsPage fetchImpl={fetchImpl} />
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>,
  )
}

describe('TripsPage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('shows an empty state with a link to create the first plan', async () => {
    signIn()
    renderTripsPage(createFakeTripsServer().fetchImpl)

    expect(await screen.findByText('아직 만든 여행 일정이 없어요.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '여행 일정 만들러 가기' })).toHaveAttribute(
      'href',
      '/plan/new',
    )
  })

  it('lists every saved trip with a link to view it', async () => {
    signIn()
    const server = createFakeTripsServer()
    const tokyo = await buildTrip(server.fetchImpl, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
    })
    const osaka = await buildTrip(server.fetchImpl, {
      ...emptyTripPlanFormValues,
      destination: '오사카',
      duration: '1박 2일',
      styles: ['쇼핑 중심'],
    })

    renderTripsPage(server.fetchImpl)

    expect(await screen.findAllByText(/일본 도쿄/)).not.toHaveLength(0)
    expect(screen.getAllByText(/오사카/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /일본 도쿄.*보기/ })).toHaveAttribute(
      'href',
      `/trips/${tokyo.id}`,
    )
    expect(screen.getByRole('link', { name: /오사카.*보기/ })).toHaveAttribute(
      'href',
      `/trips/${osaka.id}`,
    )
  })

  it('always offers a way to create another plan', async () => {
    signIn()
    const server = createFakeTripsServer()
    await buildTrip(server.fetchImpl, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
    })
    renderTripsPage(server.fetchImpl)

    expect(await screen.findByRole('link', { name: '새 일정 만들기' })).toHaveAttribute(
      'href',
      '/plan/new',
    )
  })

  it('deletes a trip after confirmation', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeTripsServer()
    const tokyo = await buildTrip(server.fetchImpl, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
    })

    renderTripsPage(server.fetchImpl)

    await user.click(await screen.findByRole('button', { name: /일본 도쿄.*삭제/ }))
    await user.click(screen.getByRole('button', { name: '삭제 확정' }))

    expect(await screen.findByText('아직 만든 여행 일정이 없어요.')).toBeInTheDocument()
    expect(server.trips.has(tokyo.id)).toBe(false)
  })

  it('translates the trip duration when the language is English', async () => {
    writeStoredLanguage('en')
    signIn()
    const server = createFakeTripsServer()
    await buildTrip(server.fetchImpl, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
    })

    renderTripsPage(server.fetchImpl)

    expect(await screen.findByText(/2 Nights 3 Days/)).toBeInTheDocument()
    expect(screen.queryByText(/2박 3일/)).not.toBeInTheDocument()
  })

  it('translates the destination name (not just the duration) when the language is English', async () => {
    writeStoredLanguage('en')
    signIn()
    const server = createFakeTripsServer()
    await buildTrip(server.fetchImpl, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
    })

    renderTripsPage(server.fetchImpl)

    expect(await screen.findByRole('heading', { name: /Tokyo, Japan/ })).toBeInTheDocument()
    expect(screen.queryByText(/일본 도쿄/)).not.toBeInTheDocument()
  })
})
