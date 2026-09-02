import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ItineraryResult } from '../components/plan/ItineraryResult'
import { getCommunityTrip, recordCommunityView, toggleCommunityLike, type CommunityTrip } from '../lib/communityTrips'
import { ApiError } from '../lib/apiClient'
import { useAuth } from '../context/authContextValue'
import { useLanguage } from '../context/languageContextValue'
import { addFavorite, isFavorited, readFavorites, removeFavorite, type FavoritePlace } from '../lib/favoritesStorage'
import { translateStyleTag } from '../lib/tripPlan'

// /community/:id 상세 화면. 다른 사람이 공유한 일정을 읽기 전용으로 보여주되, 좋아요/즐겨찾기는
// 로그인한 계정 기준으로 할 수 있다. ItineraryResult에 편집 관련 콜백을 넘기지 않아서 활동
// 삭제·시간 수정 같은 편집 UI는 자동으로 숨겨진다(원본 작성자만 자기 일정 상세에서 수정 가능).
interface CommunityTripDetailPageProps {
  fetchImpl?: typeof fetch
}

export function CommunityTripDetailPage({ fetchImpl }: CommunityTripDetailPageProps = {}) {
  const { tripId } = useParams<{ tripId: string }>()
  const { token } = useAuth()
  const { t } = useLanguage()
  const [trip, setTrip] = useState<CommunityTrip | null>(null)
  const [loading, setLoading] = useState(true)
  // 목록(커뮤니티 페이지/랜딩 페이지 미리보기)은 비로그인도 볼 수 있지만, 개별 일정의 상세는
  // 로그인해야만 볼 수 있다 — 서버가 401을 주면 "찾을 수 없음"이 아니라 "로그인이 필요해요"를
  // 따로 보여주기 위해 이 상태를 분리해뒀다.
  const [loginRequired, setLoginRequired] = useState(false)
  const [favorites, setFavorites] = useState<FavoritePlace[]>([])
  const hasRecordedView = useRef(false)

  useEffect(() => {
    let cancelled = false

    const request = tripId ? getCommunityTrip(tripId, token, fetchImpl) : Promise.resolve(null)
    request
      .then((result) => {
        if (cancelled) return
        setTrip(result)
        setLoginRequired(false)
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) {
          setLoginRequired(true)
        } else {
          setTrip(null)
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tripId, token, fetchImpl])

  useEffect(() => {
    let cancelled = false
    readFavorites(token, fetchImpl).then((result) => {
      if (!cancelled) setFavorites(result)
    })
    return () => {
      cancelled = true
    }
  }, [token, fetchImpl])

  useEffect(() => {
    // Guard against React StrictMode's dev-only double-invoke of effects, which would
    // otherwise record two views for a single page visit. The count already shown on
    // this page came from the fetch above, taken before this visit's own view is
    // recorded — so recording it here doesn't retroactively bump what's on screen.
    // 비로그인 방문자는 애초에 상세를 못 보므로(로그인 안내만 뜸) 조회수 기록도 시도하지 않는다.
    if (!tripId || !token || hasRecordedView.current) return
    hasRecordedView.current = true
    recordCommunityView(token, tripId, fetchImpl).catch(() => {})
  }, [tripId, token, fetchImpl])

  async function handleToggleLike() {
    if (!trip || !token) return
    const updated = await toggleCommunityLike(token, trip.id, fetchImpl)
    setTrip(updated)
  }

  async function handleToggleFavorite(activity: string) {
    if (!trip) return
    const place = { destination: trip.itinerary.destination, activity }

    if (isFavorited(favorites, place)) {
      const target = favorites.find((f) => f.destination === place.destination && f.activity === activity)
      if (!target) return
      await removeFavorite(token, target.id, fetchImpl)
      setFavorites((current) => current.filter((f) => f.id !== target.id))
    } else {
      const created = await addFavorite(token, place, fetchImpl)
      setFavorites((current) => [...current, created])
    }
  }

  const favoriteActivities = trip
    ? favorites.filter((f) => f.destination === trip.itinerary.destination).map((f) => f.activity)
    : []

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-2xl px-6 py-16">
          {trip ? (
            <>
              <div className="text-center">
                <Badge>{translateStyleTag(trip.tag, t)}</Badge>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {t('community.byAuthor', { author: trip.author })}
                </p>
              </div>

              <ItineraryResult
                itinerary={trip.itinerary}
                onToggleFavorite={handleToggleFavorite}
                favoriteActivities={favoriteActivities}
              />

              <div className="mt-10 flex items-center justify-center gap-6 border-t border-slate-200 pt-6 dark:border-slate-800">
                <button
                  type="button"
                  aria-pressed={trip.liked}
                  aria-label={t(trip.liked ? 'community.likeAriaCancel' : 'community.likeAria')}
                  onClick={handleToggleLike}
                  className={
                    trip.liked
                      ? 'text-accent-500'
                      : 'text-slate-500 transition-colors hover:text-accent-500 dark:text-slate-400'
                  }
                >
                  {t('community.likeButton', { count: trip.likes })}
                </button>
                <span className="text-slate-500 dark:text-slate-400">
                  {t('community.viewCount', { count: trip.views })}
                </span>
              </div>

              <div className="mt-6 text-center">
                <Button href="/community" variant="ghost" size="md">
                  {t('community.backToCommunity')}
                </Button>
              </div>
            </>
          ) : loading ? null : loginRequired ? (
            <div className="text-center">
              <p className="text-slate-600 dark:text-slate-400">{t('account.loginRequired')}</p>
              <div className="mt-6">
                <Button href="/login" variant="primary" size="md">
                  {t('account.goLoginButton')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-slate-600 dark:text-slate-400">{t('community.notFound')}</p>
              <div className="mt-6">
                <Button href="/community" variant="primary" size="md">
                  {t('community.backToCommunity')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
