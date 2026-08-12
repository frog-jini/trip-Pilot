import { useEffect, useId, useState } from 'react'
import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useAuth } from '../context/authContextValue'
import { useLanguage } from '../context/languageContextValue'
import { getCatalogPlaces, getSupportedDestinations, hasCatalog } from '../lib/destinationCatalog'
import { addFavorite, isFavorited, readFavorites, removeFavorite, type FavoritePlace } from '../lib/favoritesStorage'
import { STYLE_LABEL_KEYS, STYLE_OPTIONS } from '../lib/tripPlan'
import { translateActivityLabel } from '../lib/activityTranslation'
import { translateDestinationName } from '../lib/destinationTranslation'

// /destinations 화면. 목적지를 검색해 스타일별 대표 장소를 보여주고, 그 자리에서 즐겨찾기하거나
// 그 목적지로 일정 만들기 폼(/plan/new)으로 넘어갈 수 있다. 장소 데이터는 서버가 아니라
// destinationCatalog.ts에 정적으로 들어있어서, 카탈로그에 없는 지역은 "준비된 정보 없음"으로 처리한다.
interface DestinationSearchPageProps {
  fetchImpl?: typeof fetch
}

export function DestinationSearchPage({ fetchImpl }: DestinationSearchPageProps = {}) {
  const { token } = useAuth()
  const { t, language } = useLanguage()
  // rawQuery는 사용자가 직접 타이핑한 텍스트를 그대로 담는다. 반면 칩(추천 목적지) 클릭으로
  // 검색했을 때는 selectedDestination에 원본(한국어) 목적지명을 저장해두고, 검색창에는 매
  // 렌더마다 현재 language로 다시 번역한 값을 보여준다 — 그래야 검색 후 언어를 바꿔도 검색창
  // 표기가 즉시 새 언어로 따라간다.
  const [rawQuery, setRawQuery] = useState('')
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null)
  const [searched, setSearched] = useState<string | null>(null)
  const displayQuery = selectedDestination ? translateDestinationName(selectedDestination, language) : rawQuery
  const [favorites, setFavorites] = useState<FavoritePlace[]>([])
  const inputId = useId()

  useEffect(() => {
    let cancelled = false
    readFavorites(token, fetchImpl).then((result) => {
      if (!cancelled) setFavorites(result)
    })
    return () => {
      cancelled = true
    }
  }, [token, fetchImpl])

  function handleSearch(destination: string) {
    setRawQuery(destination)
    setSelectedDestination(destination)
    setSearched(destination)
  }

  async function handleToggleFavorite(destination: string, activity: string) {
    const place = { destination, activity }
    if (isFavorited(favorites, place)) {
      const target = favorites.find((f) => f.destination === destination && f.activity === activity)
      if (!target) return
      await removeFavorite(token, target.id, fetchImpl)
      setFavorites((current) => current.filter((f) => f.id !== target.id))
    } else {
      const created = await addFavorite(token, place, fetchImpl)
      setFavorites((current) => [...current, created])
    }
  }

  const matched = searched && hasCatalog(searched) ? searched : null

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="text-center">
            <h1 className="text-3xl">{t('destinations.heading')}</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{t('destinations.subheading')}</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSearch(selectedDestination ?? rawQuery)
            }}
            className="mx-auto mt-8 flex max-w-md gap-2"
          >
            <label htmlFor={inputId} className="sr-only">
              {t('destinations.searchLabel')}
            </label>
            <input
              id={inputId}
              value={displayQuery}
              onChange={(e) => {
                setRawQuery(e.target.value)
                setSelectedDestination(null)
              }}
              placeholder={t('destinations.searchPlaceholder')}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <Button type="submit" variant="primary" size="md">
              {t('destinations.searchButton')}
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {getSupportedDestinations().map((destination) => (
              <button
                key={destination}
                type="button"
                onClick={() => handleSearch(destination)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-primary-400 hover:text-primary-600 dark:border-slate-700 dark:text-slate-300"
              >
                {translateDestinationName(destination, language)}
              </button>
            ))}
          </div>

          {searched ? (
            matched ? (
              <div className="mt-10 space-y-6">
                <div className="text-center">
                  <Button
                    href={`/plan/new?destination=${encodeURIComponent(matched)}`}
                    variant="outline"
                    size="md"
                  >
                    {t('destinations.createPlanButton')}
                  </Button>
                </div>

                {STYLE_OPTIONS.map((style) => (
                  <Card key={style}>
                    <Badge tone="ai">{t(STYLE_LABEL_KEYS[style])}</Badge>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {getCatalogPlaces(matched, style).map((place) => {
                        const label = `${place.name} (${place.area})`
                        const displayLabel = translateActivityLabel(label, matched, language)
                        const isFavorite = favorites.some(
                          (f) => f.destination === matched && f.activity === label,
                        )
                        return (
                          <span
                            key={label}
                            className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {displayLabel}
                            <button
                              type="button"
                              aria-label={t(
                                isFavorite ? 'destinations.favoriteAriaRemove' : 'destinations.favoriteAriaAdd',
                                { label: displayLabel },
                              )}
                              aria-pressed={isFavorite}
                              onClick={() => handleToggleFavorite(matched, label)}
                              className={isFavorite ? 'text-accent-500' : 'text-slate-400 hover:text-accent-400'}
                            >
                              ★
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="mt-10 text-center">
                <p className="text-slate-600 dark:text-slate-400">{t('destinations.noCatalog')}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-500">{t('destinations.noCatalogHint')}</p>
              </div>
            )
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  )
}
