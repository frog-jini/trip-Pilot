import { FeatureCard } from './FeatureCard'
import { useLanguage } from '../../context/languageContextValue'
import {
  BookmarkIcon,
  RefreshIcon,
  SearchIcon,
  SparklesIcon,
  UsersIcon,
} from '../ui/icons'

// 랜딩 페이지 "#features" 섹션에 나열되는 핵심 기능 5개. 각 카드는 실제 해당 라우트로 링크된다.
export function FeatureSection() {
  const { t } = useLanguage()

  const features = [
    {
      icon: <SearchIcon />,
      title: t('landing.featureSearchTitle'),
      description: t('landing.featureSearchDescription'),
      href: '/destinations',
    },
    {
      icon: <SparklesIcon />,
      title: t('landing.featurePlanTitle'),
      description: t('landing.featurePlanDescription'),
      href: '/plan/new',
    },
    {
      icon: <RefreshIcon />,
      title: t('landing.featureEditTitle'),
      description: t('landing.featureEditDescription'),
      href: '/trips',
    },
    {
      icon: <UsersIcon />,
      title: t('landing.featureCommunityTitle'),
      description: t('landing.featureCommunityDescription'),
      href: '/community',
    },
    {
      icon: <BookmarkIcon />,
      title: t('landing.featureFavoritesTitle'),
      description: t('landing.featureFavoritesDescription'),
      href: '/favorites',
    },
  ]

  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-3xl">{t('landing.featuresHeading')}</h2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{t('landing.featuresDescription')}</p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  )
}
