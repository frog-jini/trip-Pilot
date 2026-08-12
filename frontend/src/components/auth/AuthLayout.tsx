// 로그인/회원가입 페이지가 공통으로 쓰는 껍데기(로고 + 카드 + 하단 링크). 실제 폼(LoginForm/
// SignupForm)은 children으로 주입받아 레이아웃과 폼 로직을 분리한다.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../ui/Card'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  footerText: string
  footerLinkText: string
  footerLinkHref: string
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footerText,
  footerLinkText,
  footerLinkHref,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 px-6 py-12 dark:from-primary-950 dark:via-slate-950 dark:to-slate-950">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-8 flex justify-center text-lg font-bold tracking-tight text-slate-900 dark:text-white"
        >
          Trai<span className="text-primary-600">lot</span>
        </Link>

        <Card className="text-center">
          <h1 className="text-2xl">{title}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>

          <div className="mt-6">{children}</div>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          {footerText}{' '}
          <Link to={footerLinkHref} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
            {footerLinkText}
          </Link>
        </p>
      </div>
    </div>
  )
}
