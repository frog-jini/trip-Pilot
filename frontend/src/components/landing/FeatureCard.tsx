import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../ui/Card'

// FeatureSection에서 쓰는 아이콘+제목+설명 카드. 카드 전체가 해당 기능 페이지로 가는 링크다.
interface FeatureCardProps {
  icon: ReactNode
  title: string
  description: string
  href: string
}

export function FeatureCard({ icon, title, description, href }: FeatureCardProps) {
  return (
    <Link to={href} className="block h-full">
      <Card className="h-full transition-shadow hover:shadow-md">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
          {icon}
        </div>
        <h3 className="mt-4 text-base">{title}</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p>
      </Card>
    </Link>
  )
}
