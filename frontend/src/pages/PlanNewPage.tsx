// "/plan/new" 화면 — 폼에 조건을 입력해서 AI가 일정을 즉시 생성하게 하는 방식.
// (대화로 만드는 방식은 PlanChatPage.tsx 참고)
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { TripPlanForm } from '../components/plan/TripPlanForm'
import { useAuth } from '../context/authContextValue'
import { useLanguage } from '../context/languageContextValue'
import { createActivityHistory, generatePlan } from '../lib/generatePlan'
import { addTrip } from '../lib/tripsStorage'
import { readFavorites, type FavoritePlace } from '../lib/favoritesStorage'
import type { TripPlanFormValues } from '../lib/tripPlan'

interface PlanNewPageProps {
  fetchImpl?: typeof fetch
}

export function PlanNewPage({ fetchImpl }: PlanNewPageProps = {}) {
  const navigate = useNavigate()
  const { token } = useAuth()
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const destination = searchParams.get('destination') ?? ''
  const [favorites, setFavorites] = useState<FavoritePlace[]>([])

  // 즐겨찾기 목록을 미리 불러와 TripPlanForm에 넘겨준다 — 목적지를 입력하면 폼이 같은 목적지의
  // 즐겨찾기를 "필수 방문지"에 자동으로 병합해주기 때문(mergeFavoritesIntoMustVisit 참고).
  useEffect(() => {
    let cancelled = false
    readFavorites(token, fetchImpl).then((result) => {
      if (!cancelled) setFavorites(result)
    })
    return () => {
      cancelled = true
    }
  }, [token, fetchImpl])

  async function handleSubmit(values: TripPlanFormValues) {
    const itinerary = generatePlan(values)
    const history = createActivityHistory(itinerary)
    const trip = await addTrip(token, { itinerary, values, history }, fetchImpl)
    navigate(`/trips/${trip.id}`)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-xl px-6 py-16">
          <div className="text-center">
            <Badge tone="ai">{t('plan.newPlanBadge')}</Badge>
            <h1 className="mt-4 text-3xl">{t('plan.newPlanHeading')}</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{t('plan.newPlanDescription')}</p>
          </div>

          <div className="mt-10">
            <Card>
              <TripPlanForm onSubmit={handleSubmit} initialValues={{ destination }} favorites={favorites} />
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
