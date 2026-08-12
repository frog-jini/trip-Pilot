// /plan/new(폼으로 일정 만들기) 화면 테스트. 폼 제출 후 생성된 일정 상세로 이동하는지,
// 목적지 즐겨찾기가 자동으로 필수 방문지에 병합되는지(쿼리 파라미터 포함) 확인한다.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PlanNewPage } from './PlanNewPage'
import { AuthProvider } from '../context/AuthContext'
import { writeStoredToken, writeStoredUser } from '../lib/authStorage'
import { createFakeApiServer, type FakeApiServer } from '../test/fakeApiServer'

function signIn(id = '1', email = 'user@example.com') {
  writeStoredUser({ id, email })
  writeStoredToken(id)
}

function renderPlanNewPage(server: FakeApiServer, path = '/plan/new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/plan/new" element={<PlanNewPage fetchImpl={server.fetchImpl} />} />
          <Route path="/trips/:tripId" element={<div>결과 페이지</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('PlanNewPage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('renders the heading and trip plan form', () => {
    signIn()
    renderPlanNewPage(createFakeApiServer())
    expect(screen.getByRole('heading', { name: '어떤 여행을 계획 중이신가요?' })).toBeInTheDocument()
    expect(screen.getByLabelText('여행지')).toBeInTheDocument()
  })

  it('navigates to the new trip detail page after generating a valid plan', async () => {
    const user = userEvent.setup()
    signIn()
    renderPlanNewPage(createFakeApiServer())

    await user.type(screen.getByLabelText('여행지'), '일본 도쿄')
    await user.type(screen.getByLabelText('여행 인원'), '2')
    await user.type(screen.getByLabelText('예산 (만원)'), '100')
    await user.click(screen.getByRole('button', { name: '쇼핑 중심' }))
    await user.click(screen.getByRole('button', { name: 'AI 일정 만들기' }))

    expect(await screen.findByText('결과 페이지')).toBeInTheDocument()
  })

  it('saves the generated plan as a new trip so it survives a page reload', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    renderPlanNewPage(server)

    await user.type(screen.getByLabelText('여행지'), '일본 도쿄')
    await user.type(screen.getByLabelText('여행 인원'), '2')
    await user.type(screen.getByLabelText('예산 (만원)'), '100')
    await user.click(screen.getByRole('button', { name: '쇼핑 중심' }))
    await user.click(screen.getByRole('button', { name: 'AI 일정 만들기' }))

    await screen.findByText('결과 페이지')
    const trips = [...server.trips.values()]
    expect(trips).toHaveLength(1)
    expect((trips[0].itinerary as { destination: string }).destination).toBe('일본 도쿄')
    expect((trips[0].formValues as { styles: string[] }).styles).toEqual(['쇼핑 중심'])
  })

  it('adds another trip instead of overwriting an existing one', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const { unmount } = renderPlanNewPage(server)

    await user.type(screen.getByLabelText('여행지'), '일본 도쿄')
    await user.type(screen.getByLabelText('여행 인원'), '2')
    await user.type(screen.getByLabelText('예산 (만원)'), '100')
    await user.click(screen.getByRole('button', { name: '쇼핑 중심' }))
    await user.click(screen.getByRole('button', { name: 'AI 일정 만들기' }))
    await screen.findByText('결과 페이지')
    unmount()

    renderPlanNewPage(server)
    await user.type(screen.getByLabelText('여행지'), '오사카')
    await user.type(screen.getByLabelText('여행 인원'), '1')
    await user.type(screen.getByLabelText('예산 (만원)'), '50')
    await user.click(screen.getByRole('button', { name: '맛집 중심' }))
    await user.click(screen.getByRole('button', { name: 'AI 일정 만들기' }))
    await screen.findByText('결과 페이지')

    const trips = [...server.trips.values()]
    expect(trips).toHaveLength(2)
    expect(trips.map((t) => (t.itinerary as { destination: string }).destination)).toEqual([
      '일본 도쿄',
      '오사카',
    ])
  })

  it('pre-fills the destination and any places already favorited for it when arriving from destination search', async () => {
    signIn()
    const server = createFakeApiServer()
    server.favorites.set('f1', { id: 'f1', userId: '1', destination: '일본 도쿄', activity: '센소지 (아사쿠사)' })
    server.favorites.set('f2', { id: 'f2', userId: '1', destination: '일본 도쿄', activity: '도쿄타워' })
    server.favorites.set('f3', { id: 'f3', userId: '1', destination: '오사카', activity: '오사카성' })

    renderPlanNewPage(server, `/plan/new?destination=${encodeURIComponent('일본 도쿄')}`)

    expect(screen.getByLabelText('여행지')).toHaveValue('일본 도쿄')
    const mustVisit = (await screen.findByLabelText('꼭 가고 싶은 곳 (선택)')) as HTMLTextAreaElement
    await waitFor(() => expect(mustVisit.value).toContain('센소지 (아사쿠사)'))
    expect(mustVisit.value).toContain('도쿄타워')
    expect(mustVisit.value).not.toContain('오사카성')
  })
})
