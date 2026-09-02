// "/trips" 화면 — 로그인한 계정이 저장한 일정 목록. 카드 클릭 시 TripDetailPage로 이동한다.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { useAuth } from '../context/authContextValue'
import { useLanguage } from '../context/languageContextValue'
import { deleteTrip, readTrips, type SavedTrip } from '../lib/tripsStorage'
import { DURATION_LABEL_KEYS } from '../lib/tripPlan'
import { translateDestinationName } from '../lib/destinationTranslation'

interface TripsPageProps {
  fetchImpl?: typeof fetch
}

export function TripsPage({ fetchImpl }: TripsPageProps = {}) {
  const { token } = useAuth()
  const { t, language } = useLanguage()
  const [trips, setTrips] = useState<SavedTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    readTrips(token, fetchImpl).then((result) => {
      if (cancelled) return
      setTrips(result)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [token, fetchImpl])

  async function handleConfirmDelete(id: string) {
    await deleteTrip(token, id, fetchImpl)
    setTrips((current) => current.filter((trip) => trip.id !== id))
    setConfirmingId(null)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-2xl px-6 py-16">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl">{t('trips.heading')}</h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400">{t('trips.subheading')}</p>
            </div>
            {trips.length > 0 ? (
              <Button href="/plan/new" variant="primary" size="md" className="shrink-0">
                {t('trips.newTripButton')}
              </Button>
            ) : null}
          </div>

          {loading ? (
            <p role="status" className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('common.loading')}
            </p>
          ) : trips.length === 0 ? (
            <div className="mt-10 text-center">
              <p className="text-slate-600 dark:text-slate-400">{t('trips.emptyMessage')}</p>
              <div className="mt-6">
                <Button href="/plan/new" variant="primary" size="md">
                  {t('trips.goCreateButton')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-10 space-y-4">
              {trips.map((trip) => {
                const destinationName = translateDestinationName(trip.itinerary.destination, language)
                return (
                <Card key={trip.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <Badge tone="ai">{t('trips.aiGenerated')}</Badge>
                    <h2 className="mt-2 text-base">
                      {destinationName} {t(DURATION_LABEL_KEYS[trip.itinerary.duration])}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {t('trips.dayCount', { count: trip.itinerary.days.length })}
                    </p>
                  </div>

                  {confirmingId === trip.id ? (
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t('trips.confirmDeletePrompt')}</p>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="md" onClick={() => setConfirmingId(null)}>
                          {t('common.cancel')}
                        </Button>
                        <Button variant="accent" size="md" onClick={() => handleConfirmDelete(trip.id)}>
                          {t('trips.confirmDeleteButton')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        to={`/trips/${trip.id}`}
                        className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
                      >
                        {t('trips.viewTrip', { destination: destinationName })}
                      </Link>
                      <button
                        type="button"
                        aria-label={t('trips.deleteAria', { destination: destinationName })}
                        onClick={() => setConfirmingId(trip.id)}
                        className="text-sm text-slate-400 hover:text-accent-600 dark:hover:text-accent-400"
                      >
                        {t('trips.deleteButton')}
                      </button>
                    </div>
                  )}
                </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
