// 라우팅 스모크 테스트: 각 경로가 실제로 해당 페이지를 렌더링하는지만 얕게 확인한다
// (페이지 자체의 상세 동작은 각 페이지별 테스트 파일이 담당).
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from './AppRoutes'
import { AuthProvider } from './context/AuthContext'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AppRoutes', () => {
  it('renders the landing page at /', () => {
    renderAt('/')
    expect(
      screen.getByRole('heading', { level: 1, name: /AI가 완성하는 나만의 여행 일정/ }),
    ).toBeInTheDocument()
  })

  it('renders the login page at /login', () => {
    renderAt('/login')
    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument()
  })

  it('renders the signup page at /signup', () => {
    renderAt('/signup')
    expect(screen.getByRole('heading', { name: '회원가입' })).toBeInTheDocument()
  })

  it('renders the trip plan form at /plan/new', () => {
    renderAt('/plan/new')
    expect(screen.getByRole('heading', { name: '어떤 여행을 계획 중이신가요?' })).toBeInTheDocument()
  })

  it('renders the AI plan chat at /plan/chat', () => {
    renderAt('/plan/chat')
    expect(screen.getByRole('heading', { level: 1, name: '대화로 여행 일정 완성하기' })).toBeInTheDocument()
  })

  it('renders the trips list empty state at /trips', async () => {
    renderAt('/trips')
    expect(await screen.findByText('아직 만든 여행 일정이 없어요.')).toBeInTheDocument()
  })

  it('renders the trip detail not-found fallback at /trips/:tripId for an unknown id', async () => {
    renderAt('/trips/does-not-exist')
    expect(await screen.findByText('해당 일정을 찾을 수 없어요.')).toBeInTheDocument()
  })

  it('renders the favorites page at /favorites', () => {
    renderAt('/favorites')
    expect(screen.getByRole('heading', { name: '즐겨찾기' })).toBeInTheDocument()
  })

  it('renders the community list at /community', () => {
    renderAt('/community')
    expect(screen.getByRole('heading', { level: 1, name: '커뮤니티' })).toBeInTheDocument()
  })

  it('renders the community trip not-found fallback at /community/:tripId for an unknown id', async () => {
    renderAt('/community/does-not-exist')
    expect(await screen.findByText('해당 커뮤니티 일정을 찾을 수 없어요.')).toBeInTheDocument()
  })

  it('renders the account login prompt at /account when logged out', () => {
    renderAt('/account')
    expect(screen.getByText('로그인이 필요해요.')).toBeInTheDocument()
  })

  it('renders the destination search page at /destinations', () => {
    renderAt('/destinations')
    expect(screen.getByRole('heading', { name: '여행지 검색' })).toBeInTheDocument()
  })
})
