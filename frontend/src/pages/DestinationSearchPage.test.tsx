// /destinations 화면 테스트. destinationCatalog.ts에 등록된 도시만 카테고리별 장소 목록을
// 보여줄 수 있으므로, 등록 도시 검색과 미등록 도시 검색을 구분해서 검증한다.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { DestinationSearchPage } from './DestinationSearchPage'
import { AuthProvider } from '../context/AuthContext'
import { LanguageProvider } from '../context/LanguageContext'
import { writeStoredToken, writeStoredUser } from '../lib/authStorage'
import { writeStoredLanguage } from '../lib/i18n/languageStorage'
import { createFakeApiServer } from '../test/fakeApiServer'

function signIn(id = '1', email = 'user@example.com') {
  writeStoredUser({ id, email })
  writeStoredToken(id)
}

function renderPage(fetchImpl?: typeof fetch) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <DestinationSearchPage fetchImpl={fetchImpl} />
      </AuthProvider>
    </MemoryRouter>,
  )
}

function renderPageWithLanguageSwitcher(fetchImpl?: typeof fetch) {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <AuthProvider>
          <DestinationSearchPage fetchImpl={fetchImpl} />
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>,
  )
}

describe('DestinationSearchPage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('renders a search input and suggested destinations before searching', () => {
    renderPage()
    expect(screen.getByLabelText('여행지 검색')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '일본 도쿄' })).toBeInTheDocument()
  })

  it('shows places grouped by category when a supported destination is searched', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('여행지 검색'), '일본 도쿄')
    await user.click(screen.getByRole('button', { name: '검색' }))

    expect(screen.getByText('관광 중심')).toBeInTheDocument()
    expect(screen.getByText('센소지 (아사쿠사)')).toBeInTheDocument()
    expect(screen.getByText('도쿄 디즈니랜드 (우라야스)')).toBeInTheDocument()
  })

  it('shows a fallback with suggestions for an unsupported destination', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('여행지 검색'), '평행우주 도시')
    await user.click(screen.getByRole('button', { name: '검색' }))

    expect(screen.getByText('아직 준비된 여행지 정보가 없어요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '일본 도쿄' })).toBeInTheDocument()
  })

  it('fills the search and shows results when a suggested destination chip is clicked', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: '제주' }))

    expect(screen.getByText('성산일출봉 (성산읍)')).toBeInTheDocument()
  })

  it('lets me favorite a place directly from search results', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    renderPage(server.fetchImpl)

    await user.click(screen.getByRole('button', { name: '제주' }))
    await user.click(screen.getByRole('button', { name: '성산일출봉 (성산읍) 즐겨찾기 추가' }))

    expect(await screen.findByRole('button', { name: '성산일출봉 (성산읍) 즐겨찾기 해제' })).toBeInTheDocument()
    expect([...server.favorites.values()]).toContainEqual(
      expect.objectContaining({ destination: '제주', activity: '성산일출봉 (성산읍)' }),
    )
  })

  it('finds a destination by a short alias like 도쿄 instead of requiring the full name', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('여행지 검색'), '도쿄')
    await user.click(screen.getByRole('button', { name: '검색' }))

    expect(screen.getByText('센소지 (아사쿠사)')).toBeInTheDocument()
  })

  it('finds a newly supported destination such as 뉴욕', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('여행지 검색'), '뉴욕')
    await user.click(screen.getByRole('button', { name: '검색' }))

    expect(screen.queryByText('아직 준비된 여행지 정보가 없어요.')).not.toBeInTheDocument()
  })

  it('shows the search box text translated when a destination chip is clicked in English', async () => {
    const user = userEvent.setup()
    writeStoredLanguage('en')
    renderPageWithLanguageSwitcher()

    await user.click(screen.getByRole('button', { name: 'Tokyo, Japan' }))

    expect(screen.getByLabelText('Search destination')).toHaveValue('Tokyo, Japan')
    expect(screen.queryByDisplayValue('일본 도쿄')).not.toBeInTheDocument()
  })

  it('retranslates the search box text when the language changes after clicking a chip', async () => {
    const user = userEvent.setup()
    renderPageWithLanguageSwitcher()

    await user.click(screen.getByRole('button', { name: '일본 도쿄' }))
    expect(screen.getByLabelText('여행지 검색')).toHaveValue('일본 도쿄')

    await user.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByLabelText('Search destination')).toHaveValue('Tokyo, Japan')
  })

  it('offers a link to start planning a trip to this destination, carrying the destination along', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: '일본 도쿄' }))

    expect(screen.getByRole('link', { name: '이 여행지로 일정 만들기' })).toHaveAttribute(
      'href',
      `/plan/new?destination=${encodeURIComponent('일본 도쿄')}`,
    )
  })
})
