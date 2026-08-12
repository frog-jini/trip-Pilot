import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { useAuth } from '../../context/authContextValue'
import { useLanguage } from '../../context/languageContextValue'
import { readTrips, type SavedTrip } from '../../lib/tripsStorage'
import { DURATION_LABEL_KEYS } from '../../lib/tripPlan'
import { translateActivityLabel } from '../../lib/activityTranslation'
import { translateDestinationName } from '../../lib/destinationTranslation'

interface HeroProps {
  fetchImpl?: typeof fetch
}

// 랜딩 페이지 최상단 히어로 섹션. 로그인 여부 + 실제 저장된 일정 유무에 따라 세 가지 버전 중
// 하나를 보여준다: (1) 최근 만든 일정이 있는 사용자, (2) 로그인은 했지만 일정이 없는 사용자,
// (3) 비로그인 방문자. sampleDays는 (2)·(3)에서 보여줄 예시용 목업 일정이다.
export function Hero({ fetchImpl }: HeroProps = {}) {
  const { user, token } = useAuth()
  const { t, language } = useLanguage()
  const [trips, setTrips] = useState<SavedTrip[]>([])

  const sampleDays = [
    { day: t('landing.heroSampleDay1'), plan: t('landing.heroSampleDay1Plan') },
    { day: t('landing.heroSampleDay2'), plan: t('landing.heroSampleDay2Plan') },
    { day: t('landing.heroSampleDay3'), plan: t('landing.heroSampleDay3Plan') },
  ]

  useEffect(() => {
    let cancelled = false

    readTrips(token, fetchImpl).then((result) => {
      if (!cancelled) setTrips(result)
    })

    return () => {
      cancelled = true
    }
  }, [token, fetchImpl])

  // API가 최신순으로 정렬해서 돌려주므로 첫 번째가 가장 최근 일정이다.
  const latestTrip = trips[0]

  if (user && latestTrip) {
    const translatedDuration = t(DURATION_LABEL_KEYS[latestTrip.itinerary.duration])
    const translatedDestination = translateDestinationName(latestTrip.itinerary.destination, language)
    return (
      <HeroLayout
        badge={t('landing.heroBadgeMyTrips')}
        heading={t('landing.heroHeadingMyTrips')}
        description={t('landing.heroDescriptionMyTrips', {
          destination: translatedDestination,
          duration: translatedDuration,
          count: trips.length,
        })}
        primary={{ href: '/trips', label: t('landing.heroPrimaryViewTrips') }}
        secondary={{ href: '/plan/new', label: t('landing.heroSecondaryNewTrip') }}
        cardTitle={t('landing.heroCardTitle', {
          destination: translatedDestination,
          duration: translatedDuration,
        })}
        cardDays={latestTrip.itinerary.days.slice(0, 3).map((d) => ({
          day: t('common.dayLabel', { n: d.day }),
          plan: d.activities
            .map((activity) => translateActivityLabel(activity, latestTrip.itinerary.destination, language))
            .join(' · '),
        }))}
        aiGeneratedLabel={t('landing.heroCardAiGenerated')}
      />
    )
  }

  if (user) {
    return (
      <HeroLayout
        badge={t('landing.heroBadgeAiPlanner')}
        heading={t('landing.heroHeadingUserNoTrip')}
        description={t('landing.heroDescriptionGeneric')}
        primary={{ href: '/plan/new', label: t('landing.heroPrimaryCreate') }}
        secondary={{ href: '#community', label: t('landing.heroSecondaryBrowseCommunity') }}
        cardTitle={t('landing.heroCardTitleSample')}
        cardDays={sampleDays}
        aiGeneratedLabel={t('landing.heroCardAiGenerated')}
      />
    )
  }

  return (
    <HeroLayout
      badge={t('landing.heroBadgeAiPlanner')}
      heading={t('landing.heroHeadingAnonymous')}
      description={t('landing.heroDescriptionGeneric')}
      primary={{ href: '/signup', label: t('landing.heroPrimarySignup') }}
      secondary={{ href: '#community', label: t('landing.heroSecondaryBrowseCommunity') }}
      cardTitle={t('landing.heroCardTitleSample')}
      cardDays={sampleDays}
      aiGeneratedLabel={t('landing.heroCardAiGenerated')}
    />
  )
}

interface HeroLayoutProps {
  badge: string
  heading: string
  description: string
  primary: { href: string; label: string }
  secondary: { href: string; label: string }
  cardTitle: string
  cardDays: { day: string; plan: string }[]
  aiGeneratedLabel: string
}

// 위 세 가지 버전이 전부 같은 레이아웃(왼쪽 카피 + 오른쪽 예시 일정 카드)을 공유하므로,
// 문구·링크·카드 내용만 props로 갈아끼우는 공통 레이아웃으로 분리했다.
function HeroLayout({
  badge,
  heading,
  description,
  primary,
  secondary,
  cardTitle,
  cardDays,
  aiGeneratedLabel,
}: HeroLayoutProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-primary-950 dark:via-slate-950 dark:to-slate-950" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
        <div>
          <Badge tone="ai">{badge}</Badge>

          <h1 className="mt-4 text-4xl leading-tight md:text-5xl">{heading}</h1>

          <p className="mt-5 max-w-md text-base text-slate-600 md:text-lg dark:text-slate-400">
            {description}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button href={primary.href} variant="primary" size="lg">
              {primary.label}
            </Button>
            <Button href={secondary.href} variant="outline" size="lg">
              {secondary.label}
            </Button>
          </div>
        </div>

        <Card className="mx-auto w-full max-w-sm space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{cardTitle}</p>
            <Badge tone="ai">{aiGeneratedLabel}</Badge>
          </div>

          {cardDays.map((item) => (
            <div
              key={item.day}
              className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800"
            >
              <span className="font-semibold text-primary-600 dark:text-primary-400">{item.day}</span>
              <span className="text-slate-600 dark:text-slate-300">{item.plan}</span>
            </div>
          ))}
        </Card>
      </div>
    </section>
  )
}
