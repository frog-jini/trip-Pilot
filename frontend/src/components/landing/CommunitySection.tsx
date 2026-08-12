import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { CommunityTripCard } from '../community/CommunityTripCard'
import { getCommunityTrips, toggleCommunityLike, type CommunityTrip } from '../../lib/communityTrips'
import { useAuth } from '../../context/authContextValue'
import { useLanguage } from '../../context/languageContextValue'

// 랜딩 페이지에서 커뮤니티 인기 일정 3건을 미리보기로 보여주는 섹션(전체 목록은 /community).
interface CommunitySectionProps {
  fetchImpl?: typeof fetch
}

export function CommunitySection({ fetchImpl }: CommunitySectionProps = {}) {
  const { token } = useAuth()
  const { t } = useLanguage()
  const [trips, setTrips] = useState<CommunityTrip[]>([])

  useEffect(() => {
    let cancelled = false
    getCommunityTrips(token, fetchImpl)
      .then((result) => {
        if (!cancelled) setTrips(result)
      })
      .catch(() => {
        // 비로그인 상태거나 API 요청이 실패해도 랜딩 페이지 자체는 깨지면 안 되므로
        // 조용히 빈 목록으로 두고 섹션을 그냥 비워서 보여준다.
        if (!cancelled) setTrips([])
      })
    return () => {
      cancelled = true
    }
  }, [token, fetchImpl])

  async function handleToggleLike(id: string) {
    if (!token) return
    const updated = await toggleCommunityLike(token, id, fetchImpl)
    setTrips((current) => current.map((trip) => (trip.id === id ? updated : trip)))
  }

  // 랜딩 페이지는 미리보기 성격이라 전체 목록 중 3개만 보여주고, 나머지는 "여행 코스 더 보기"로 유도한다.
  const previewTrips = trips.slice(0, 3)

  return (
    <section id="community" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-3xl">{t('landing.communityHeading')}</h2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{t('landing.communityDescription')}</p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {previewTrips.map((trip) => (
          <CommunityTripCard key={trip.id} trip={trip} onToggleLike={handleToggleLike} />
        ))}
      </div>

      <div className="mt-10 text-center">
        <Button href="/community" variant="outline" size="md">
          {t('landing.communityMoreButton')}
        </Button>
      </div>
    </section>
  )
}
