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
export function Header({ fetchWeather }: HeaderProps = {}) {
  const { user, logout } = useAuth()
  const { t } = useLanguage()

  const navLinks = [
    { href: '/#features', label: t('header.features') },
    { href: '/#ai-chat', label: t('header.aiChat') },
    { href: '/community', label: t('header.community') },
  ]

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

        {user ? (
          <div className="flex items-center gap-3">
            <Link
              to="/account"
              aria-label={t('header.profile')}
              className="hidden text-sm text-slate-600 hover:text-primary-600 sm:inline dark:text-slate-300 dark:hover:text-primary-400"
            >
              {user.email}
            </Link>
            <Link
              to="/trips"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              {t('header.myTrips')}
            </Link>
            <Link
              to="/favorites"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              {t('header.favorites')}
            </Link>
            <Link to="/plan/new" className={buttonClasses('primary', 'md')}>
              {t('header.createPlan')}
            </Link>
            <button type="button" onClick={logout} className={buttonClasses('ghost', 'md')}>
              {t('header.logout')}
            </button>
            <LanguageSwitcher />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login" className={buttonClasses('ghost', 'md')}>
              {t('header.login')}
            </Link>
            <Link to="/signup" className={buttonClasses('primary', 'md')}>
              {t('header.signupCta')}
            </Link>
            <LanguageSwitcher />
          </div>
        )}
      </div>
    </header>
  )
}
