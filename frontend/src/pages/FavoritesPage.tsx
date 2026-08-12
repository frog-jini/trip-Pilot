import { useEffect, useState } from 'react'
import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useAuth } from '../context/authContextValue'
import { useLanguage } from '../context/languageContextValue'
import { readFavorites, removeFavorite, type FavoritePlace } from '../lib/favoritesStorage'
import { translateDestinationName } from '../lib/destinationTranslation'
import { translateActivityLabel } from '../lib/activityTranslation'

// favorites 화면. 목적지별로 묶어서 보여줘야 "일정 만들기 폼에서 자동으로 병합되는 장소"가
// 어느 목적지 것인지 한눈에 파악할 수 있다 (mergeFavoritesIntoMustVisit이 이 목적지 매칭을 사용).
function groupByDestination(favorites: FavoritePlace[]): Map<string, FavoritePlace[]> {
  const groups = new Map<string, FavoritePlace[]>()
  for (const favorite of favorites) {
    const places = groups.get(favorite.destination) ?? []
    groups.set(favorite.destination, [...places, favorite])
  }
  return groups
}

interface FavoritesPageProps {
  fetchImpl?: typeof fetch
}

export function FavoritesPage({ fetchImpl }: FavoritesPageProps = {}) {
  const { token } = useAuth()
  const { t, language } = useLanguage()
  const [favorites, setFavorites] = useState<FavoritePlace[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    readFavorites(token, fetchImpl).then((result) => {
      if (cancelled) return
      setFavorites(result)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [token, fetchImpl])

  async function handleRemove(favorite: FavoritePlace) {
    await removeFavorite(token, favorite.id, fetchImpl)
    setFavorites((current) => current.filter((f) => f.id !== favorite.id))
  }

  const groups = groupByDestination(favorites)

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-2xl px-6 py-16">
          <div className="text-center">
            <h1 className="text-3xl">{t('favorites.heading')}</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{t('favorites.subheading')}</p>
          </div>

          {loading ? (
            <p role="status" className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('common.loading')}
            </p>
          ) : groups.size === 0 ? (
            <div className="mt-10 text-center">
              <p className="text-slate-600 dark:text-slate-400">{t('favorites.emptyMessage')}</p>
              <div className="mt-6">
                <Button href="/plan/new" variant="primary" size="md">
                  {t('favorites.goCreateButton')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-10 space-y-4">
              {[...groups.entries()].map(([destination, places]) => (
                <Card key={destination}>
                  <h2 className="text-base text-primary-700 dark:text-primary-400">
                    {translateDestinationName(destination, language)}
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {places.map((place) => {
                      const displayActivity = translateActivityLabel(place.activity, destination, language)
                      return (
                      <li
                        key={place.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <span>{displayActivity}</span>
                        <button
                          type="button"
                          aria-label={t('favorites.removeAria', { activity: displayActivity })}
                          aria-pressed="true"
                          onClick={() => handleRemove(place)}
                          className="shrink-0 text-accent-500"
                        >
                          ★
                        </button>
                      </li>
                      )
                    })}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
