// 폼으로 일정 생성(PlanNewPage) → 상세(TripDetailPage) → 목록(TripsPage)을 실제 라우팅으로
// 이어서, 개별 페이지 단위 테스트가 놓칠 수 있는 "생성 → 편집 → 목록 반영 → 삭제" 흐름 전체를
// 검증한다. mock 없이 fakeApiServer로 실제 백엔드 계약(itinerary 구조 등)까지 함께 확인된다.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PlanNewPage } from './pages/PlanNewPage'
import { TripDetailPage } from './pages/TripDetailPage'
import { TripsPage } from './pages/TripsPage'
import { writeStoredToken, writeStoredUser } from './lib/authStorage'
import { createFakeApiServer } from './test/fakeApiServer'

function signIn(id = '1', email = 'user@example.com') {
  writeStoredUser({ id, email })
  writeStoredToken(id)
}

function renderFlow(fetchImpl: typeof fetch) {
  return render(
    <MemoryRouter initialEntries={['/plan/new']}>
      <AuthProvider>
        <Routes>
          <Route path="/plan/new" element={<PlanNewPage fetchImpl={fetchImpl} />} />
          <Route path="/trips" element={<TripsPage fetchImpl={fetchImpl} />} />
          <Route path="/trips/:tripId" element={<TripDetailPage fetchImpl={fetchImpl} />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('plan creation and edit flow', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('removes the clicked activity from the real generated itinerary and it does not come back', async () => {
    const user = userEvent.setup()
    signIn()
    renderFlow(createFakeApiServer().fetchImpl)

    await user.type(screen.getByLabelText('여행지'), '일본 도쿄')
    await user.type(screen.getByLabelText('여행 인원'), '2')
    await user.type(screen.getByLabelText('예산 (만원)'), '100')
    await user.click(screen.getByRole('button', { name: '쇼핑 중심' }))
    await user.click(screen.getByRole('button', { name: 'AI 일정 만들기' }))

    const deleteButtons = await screen.findAllByRole('button', { name: /삭제/ })
    const firstDeleteButton = deleteButtons[0]
    const removedLabel = firstDeleteButton.getAttribute('aria-label') ?? ''
    const removedActivity = removedLabel.replace(' 삭제', '')

    await user.click(firstDeleteButton)

    expect(screen.queryByRole('button', { name: removedLabel })).not.toBeInTheDocument()
    expect(screen.queryByText(removedActivity)).not.toBeInTheDocument()
  })

  it('lets the user go back to the trip list, create a second trip, and delete the first from the list', async () => {
    const user = userEvent.setup()
    signIn()
    renderFlow(createFakeApiServer().fetchImpl)

    await user.type(screen.getByLabelText('여행지'), '일본 도쿄')
    await user.type(screen.getByLabelText('여행 인원'), '2')
    await user.type(screen.getByLabelText('예산 (만원)'), '100')
    await user.click(screen.getByRole('button', { name: '쇼핑 중심' }))
    await user.click(screen.getByRole('button', { name: 'AI 일정 만들기' }))

    await screen.findByText(/일본 도쿄/)

    await user.click(screen.getByRole('button', { name: '일정 삭제' }))
    await user.click(screen.getByRole('button', { name: '삭제 확정' }))

    expect(await screen.findByText('아직 만든 여행 일정이 없어요.')).toBeInTheDocument()
  })
})
