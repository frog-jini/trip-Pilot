// /favorites 목록 화면 테스트. 목적지별로 묶여서 보이는지, 삭제가 fakeFavoritesServer에 반영되는지 확인한다.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FavoritesPage } from './FavoritesPage'
import { AuthProvider } from '../context/AuthContext'
import { LanguageProvider } from '../context/LanguageContext'
import { writeStoredToken, writeStoredUser } from '../lib/authStorage'
import { writeStoredLanguage } from '../lib/i18n/languageStorage'
import { createFakeFavoritesServer } from '../test/fakeFavoritesServer'

function signIn(id = '1', email = 'user@example.com') {
  writeStoredUser({ id, email })
  writeStoredToken(id)
}

function renderFavoritesPage(fetchImpl: typeof fetch) {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <AuthProvider>
          <FavoritesPage fetchImpl={fetchImpl} />
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>,
  )
}

describe('FavoritesPage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('shows an empty state with a link to start planning when there are no favorites', async () => {
    signIn()
    renderFavoritesPage(createFakeFavoritesServer().fetchImpl)

    expect(await screen.findByText('아직 즐겨찾기한 장소가 없어요.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '여행 일정 만들러 가기' })).toHaveAttribute(
      'href',
      '/plan/new',
    )
  })

  it('groups favorited places by destination', async () => {
    signIn()
    const server = createFakeFavoritesServer()
    server.favorites.set('f1', { id: 'f1', userId: '1', destination: '일본 도쿄', activity: '아사쿠사 관광' })
    server.favorites.set('f2', { id: 'f2', userId: '1', destination: '일본 도쿄', activity: '긴자 맛집 투어' })
    server.favorites.set('f3', { id: 'f3', userId: '1', destination: '오사카', activity: '도톤보리 맛집 탐방' })

    renderFavoritesPage(server.fetchImpl)

    expect(await screen.findByRole('heading', { name: '일본 도쿄' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '오사카' })).toBeInTheDocument()
    expect(screen.getByText('아사쿠사 관광')).toBeInTheDocument()
    expect(screen.getByText('긴자 맛집 투어')).toBeInTheDocument()
    expect(screen.getByText('도톤보리 맛집 탐방')).toBeInTheDocument()
  })

  it('removes a favorite when its remove button is clicked', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeFavoritesServer()
    server.favorites.set('f1', { id: 'f1', userId: '1', destination: '일본 도쿄', activity: '아사쿠사 관광' })

    renderFavoritesPage(server.fetchImpl)

    await user.click(await screen.findByRole('button', { name: '아사쿠사 관광 즐겨찾기 해제' }))

    expect(screen.queryByText('아사쿠사 관광')).not.toBeInTheDocument()
    expect(screen.getByText('아직 즐겨찾기한 장소가 없어요.')).toBeInTheDocument()
    expect(server.favorites.has('f1')).toBe(false)
  })

  it('translates the destination group heading and activity name when the language is English', async () => {
    writeStoredLanguage('en')
    signIn()
    const server = createFakeFavoritesServer()
    server.favorites.set('f1', { id: 'f1', userId: '1', destination: '일본 도쿄', activity: '아사쿠사 관광' })

    renderFavoritesPage(server.fetchImpl)

    expect(await screen.findByRole('heading', { name: 'Tokyo, Japan' })).toBeInTheDocument()
    expect(screen.getByText('Asakusa Sightseeing')).toBeInTheDocument()
    expect(screen.queryByText('일본 도쿄')).not.toBeInTheDocument()
    expect(screen.queryByText('아사쿠사 관광')).not.toBeInTheDocument()
  })
})
