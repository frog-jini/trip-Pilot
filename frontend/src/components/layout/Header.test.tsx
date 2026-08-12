// 헤더의 로그인/비로그인 분기 렌더링과 날씨 배지 위치를 검증한다. fetchWeather를 실제 API가
// 아닌 고정 응답 mock으로 주입해서, 네트워크 없이도 날씨 배지 노출 여부를 결정적으로 테스트한다.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Header } from './Header'
import { AuthProvider } from '../../context/AuthContext'
import { LanguageProvider } from '../../context/LanguageContext'
import { writeStoredUser } from '../../lib/authStorage'

const fetchWeather = vi
  .fn()
  .mockResolvedValue({ condition: 'sunny', label: '맑음', icon: '☀️', temperature: 25 })

function renderHeader() {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <AuthProvider>
          <Header fetchWeather={fetchWeather} />
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>,
  )
}

describe('Header', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('renders the brand name linking to home', () => {
    renderHeader()
    const brand = screen.getByRole('link', { name: 'Trailot' })
    expect(brand).toHaveAttribute('href', '/')
  })

  it("renders today's weather to the left of the brand logo", async () => {
    renderHeader()
    const weather = await screen.findByLabelText(/오늘 날씨/)
    const brand = screen.getByRole('link', { name: 'Trailot' })

    expect(weather.compareDocumentPosition(brand) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders navigation links that work from any page', () => {
    renderHeader()
    expect(screen.getByRole('link', { name: '기능' })).toHaveAttribute('href', '/#features')
    expect(screen.getByRole('link', { name: 'AI 채팅' })).toHaveAttribute('href', '/#ai-chat')
    expect(screen.getByRole('link', { name: '커뮤니티' })).toHaveAttribute('href', '/community')
  })

  it('renders login and signup actions when logged out', () => {
    renderHeader()
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: '무료로 시작하기' })).toHaveAttribute('href', '/signup')
  })

  it('renders the account email and logout action when logged in', () => {
    writeStoredUser({ email: 'user@example.com' })
    renderHeader()

    expect(screen.getByText('user@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '프로필' })).toHaveAttribute('href', '/account')
    expect(screen.getByRole('link', { name: '내 일정' })).toHaveAttribute('href', '/trips')
    expect(screen.getByRole('link', { name: '일정 만들기' })).toHaveAttribute('href', '/plan/new')
    expect(screen.getByRole('link', { name: '즐겨찾기' })).toHaveAttribute('href', '/favorites')
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument()
  })

  it('does not render the favorites or trips links when logged out', () => {
    renderHeader()
    expect(screen.queryByRole('link', { name: '즐겨찾기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '내 일정' })).not.toBeInTheDocument()
  })

  it('returns to the logged-out state after clicking logout', async () => {
    const user = userEvent.setup()
    writeStoredUser({ email: 'user@example.com' })
    renderHeader()

    await user.click(screen.getByRole('button', { name: '로그아웃' }))

    expect(screen.getByRole('link', { name: '로그인' })).toBeInTheDocument()
  })

  it('renders the language switcher as the last element of the header', () => {
    renderHeader()
    const switcher = screen.getByRole('group', { name: '언어 선택' })
    const brand = screen.getByRole('link', { name: 'Trailot' })

    expect(brand.compareDocumentPosition(switcher) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('translates the nav and auth actions to English when the switcher is used', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '/#features')
    expect(screen.getByRole('link', { name: 'AI Chat' })).toHaveAttribute('href', '/#ai-chat')
    expect(screen.getByRole('link', { name: 'Community' })).toHaveAttribute('href', '/community')
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start for Free' })).toBeInTheDocument()
  })

  it('translates the logged-in actions to Japanese when the switcher is used', async () => {
    const user = userEvent.setup()
    writeStoredUser({ email: 'user@example.com' })
    renderHeader()

    await user.click(screen.getByRole('button', { name: '日本語' }))

    expect(screen.getByRole('link', { name: 'マイ旅程' })).toHaveAttribute('href', '/trips')
    expect(screen.getByRole('link', { name: 'お気に入り' })).toHaveAttribute('href', '/favorites')
    expect(screen.getByRole('link', { name: 'プラン作成' })).toHaveAttribute('href', '/plan/new')
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
  })
})
