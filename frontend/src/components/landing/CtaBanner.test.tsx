// 랜딩 페이지 하단 CTA 배너가 로그인 여부에 따라 다른 문구/링크(회원가입 유도 vs 일정 만들기
// 유도)를 보여주는지 검증한다.
import { render, screen } from '@testing-library/react'
import { CtaBanner } from './CtaBanner'
import { AuthProvider } from '../../context/AuthContext'
import { LanguageProvider } from '../../context/LanguageContext'
import { writeStoredUser } from '../../lib/authStorage'
import { writeStoredLanguage } from '../../lib/i18n/languageStorage'

function renderCtaBanner() {
  return render(
    <LanguageProvider>
      <AuthProvider>
        <CtaBanner />
      </AuthProvider>
    </LanguageProvider>,
  )
}

describe('CtaBanner', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('renders a closing call to action linking to signup when logged out', () => {
    renderCtaBanner()
    expect(screen.getByRole('link', { name: '무료로 시작하기' })).toHaveAttribute('href', '/signup')
  })

  it('invites logged-in users to plan another trip instead of signing up', () => {
    writeStoredUser({ email: 'user@example.com' })
    renderCtaBanner()

    expect(screen.getByRole('link', { name: '일정 만들기' })).toHaveAttribute('href', '/plan/new')
    expect(screen.queryByRole('link', { name: '무료로 시작하기' })).not.toBeInTheDocument()
  })

  it('renders the anonymous CTA in English when the language is set to en', () => {
    writeStoredLanguage('en')
    renderCtaBanner()
    expect(screen.getByRole('link', { name: 'Start for Free' })).toHaveAttribute('href', '/signup')
  })

  it('renders the logged-in CTA in Japanese when the language is set to ja', () => {
    writeStoredLanguage('ja')
    writeStoredUser({ email: 'user@example.com' })
    renderCtaBanner()
    expect(screen.getByRole('link', { name: 'プランを作成' })).toHaveAttribute('href', '/plan/new')
  })
})
