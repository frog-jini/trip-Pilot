// 커뮤니티 목록(/community)에 나오는 일정 카드 하나. 좋아요 토글만 이 카드에서 바로 처리하고,
// 조회수 증가는 상세 페이지(/community/:id) 진입 시에만 일어나므로 여기서는 표시만 한다.
import { Link } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { useLanguage } from '../../context/languageContextValue'
import { DURATION_LABEL_KEYS, translateStyleTag } from '../../lib/tripPlan'
import { translateDestinationName } from '../../lib/destinationTranslation'
import type { CommunityTrip } from '../../lib/communityTrips'

interface CommunityTripCardProps {
  trip: CommunityTrip
  onToggleLike: (id: string) => void
}

export function CommunityTripCard({ trip, onToggleLike }: CommunityTripCardProps) {
  const { t, language } = useLanguage()
  const { liked, likes: likeCount, views: viewCount } = trip
  const destinationName = translateDestinationName(trip.itinerary.destination, language)

  return (
    <Card>
      <Badge>{translateStyleTag(trip.tag, t)}</Badge>
      <h3 className="mt-4 text-base">
        {destinationName} {t(DURATION_LABEL_KEYS[trip.itinerary.duration])}
      </h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('community.byAuthor', { author: trip.author })}</p>

      <div className="mt-4 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
        <button
          type="button"
          aria-pressed={liked}
          aria-label={t(liked ? 'community.likeAriaCancel' : 'community.likeAria')}
          onClick={() => onToggleLike(trip.id)}
          className={liked ? 'text-accent-500' : 'transition-colors hover:text-accent-500'}
        >
          {t('community.likeButton', { count: likeCount })}
        </button>
        <span>{t('community.viewCount', { count: viewCount })}</span>
      </div>

      <Link
        to={`/community/${trip.id}`}
        aria-label={t('community.viewTripAria', { destination: destinationName })}
        className="mt-4 inline-block text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
      >
        {t('community.viewTripLink')}
      </Link>
    </Card>
  )
}
