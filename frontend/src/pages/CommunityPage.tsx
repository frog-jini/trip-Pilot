import { useEffect, useState } from 'react'
import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { CommunityTripCard } from '../components/community/CommunityTripCard'
import { getCommunityTrips, toggleCommunityLike, type CommunityTrip } from '../lib/communityTrips'
import { useAuth } from '../context/authContextValue'
import { useLanguage } from '../context/languageContextValue'

// /community 목록 화면. 데모 시드 게시글과 실제 사용자가 공유한 일정이 같은 목록에 섞여서 나온다
// (좋아요순 정렬은 백엔드에서 처리 — 여기선 받은 순서를 그대로 그린다).
interface CommunityPageProps {
  fetchImpl?: typeof fetch
}

export function CommunityPage({ fetchImpl }: CommunityPageProps = {}) {
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
        // 목록 조회가 실패해도 빈 화면으로만 처리하고 별도 에러 UI는 두지 않는다 —
        // 커뮤니티는 부가 기능이라 실패 시에도 페이지 자체는 정상적으로 보여주는 게 낫다.
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

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="mx-auto max-w-xl text-center">
            <h1 className="text-3xl">{t('community.heading')}</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{t('community.subheading')}</p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <CommunityTripCard key={trip.id} trip={trip} onToggleLike={handleToggleLike} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
