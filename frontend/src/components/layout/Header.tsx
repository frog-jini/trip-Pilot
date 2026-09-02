import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { buttonClasses } from '../ui/buttonStyles'
import { useAuth } from '../../context/authContextValue'
import { useLanguage } from '../../context/languageContextValue'
import { WeatherBadge } from './WeatherBadge'
import { LanguageSwitcher } from './LanguageSwitcher'
import type { TodayWeather } from '../../lib/weather'

interface HeaderProps {
  fetchWeather?: () => Promise<TodayWeather>
}

// 모든 페이지 상단 공통 헤더. 로그인 여부에 따라 오른쪽 영역(내 일정/즐겨찾기/로그아웃 vs
// 로그인/가입)이 통째로 바뀐다. 언어 전환 버튼(LanguageSwitcher)은 항상 맨 오른쪽 끝에 둔다.
//
// 좁은 화면(모바일)에서는 nav 링크 + 오른쪽 액션이 한 줄에 다 안 들어가서 그냥 두면 줄바꿈으로
// 세로로 쌓여버린다 — 그래서 md 미만에서는 데스크톱 줄 전체를 숨기고, 대신 햄버거 버튼으로
// 여닫는 드롭다운 패널에 같은 링크/액션을 세로로 배치한다.
export function Header({ fetchWeather }: HeaderProps = {}) {
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { href: '/#features', label: t('header.features') },
    { href: '/#ai-chat', label: t('header.aiChat') },
    { href: '/community', label: t('header.community') },
  ]

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  function handleLogout() {
    closeMobileMenu()
    logout()
  }

  // 로그인 여부에 따른 오른쪽 액션 그룹. layout="row"는 데스크톱 가로 배치, layout="column"은
  // 모바일 드롭다운 안에서의 세로 배치용으로 같은 링크/버튼을 재사용한다.
  function renderAuthActions(layout: 'row' | 'column'): ReactNode {
    const groupClassName = layout === 'row' ? 'flex items-center gap-3' : 'flex flex-col items-stretch gap-2'
    const linkClassName =
      layout === 'row'
        ? 'text-sm font-medium text-slate-600 transition-colors hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400'
        : 'rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-primary-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-primary-400'

    if (!user) {
      return (
        <div className={groupClassName}>
          <Link to="/login" className={buttonClasses('ghost', 'md')} onClick={closeMobileMenu}>
            {t('header.login')}
          </Link>
          <Link to="/signup" className={buttonClasses('primary', 'md')} onClick={closeMobileMenu}>
            {t('header.signupCta')}
          </Link>
        </div>
      )
    }

    return (
      <div className={groupClassName}>
        <Link
          to="/account"
          aria-label={t('header.profile')}
          className={layout === 'row' ? `hidden sm:inline ${linkClassName}` : linkClassName}
          onClick={closeMobileMenu}
        >
          {user.nickname ?? user.email}
        </Link>
        <Link to="/trips" className={linkClassName} onClick={closeMobileMenu}>
          {t('header.myTrips')}
        </Link>
        <Link to="/favorites" className={linkClassName} onClick={closeMobileMenu}>
          {t('header.favorites')}
        </Link>
        <Link to="/plan/new" className={buttonClasses('primary', 'md')} onClick={closeMobileMenu}>
          {t('header.createPlan')}
        </Link>
        <button type="button" onClick={handleLogout} className={buttonClasses('ghost', 'md')}>
          {t('header.logout')}
        </button>
      </div>
    )
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <WeatherBadge fetchWeather={fetchWeather} />
          <Link to="/" className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Trai<span className="text-primary-600">lot</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {renderAuthActions('row')}
          <LanguageSwitcher />
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={t('header.menu')}
          aria-expanded={mobileMenuOpen}
          className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
        >
          {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {mobileMenuOpen ? (
        <div className="border-t border-slate-200 px-6 py-4 md:hidden dark:border-slate-800">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={closeMobileMenu}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-primary-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-primary-400"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="my-3 border-t border-slate-200 dark:border-slate-800" />
          {renderAuthActions('column')}
          <div className="mt-3 flex justify-center">
            <LanguageSwitcher />
          </div>
        </div>
      ) : null}
    </header>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}
