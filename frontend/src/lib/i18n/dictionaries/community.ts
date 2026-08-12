import type { Language } from '../language'

// /community 목록·상세 화면, CommunityTripCard.
export const communityDictionary: Record<Language, Record<string, string>> = {
  ko: {
    heading: '커뮤니티',
    subheading: '다른 여행자들이 다녀온 여행 코스를 둘러보고 내 일정에 참고해보세요.',
    byAuthor: 'by {{author}}',
    likeAria: '좋아요',
    likeAriaCancel: '좋아요 취소',
    likeButton: '❤ 좋아요 {{count}}',
    viewCount: '조회 {{count}}',
    viewTripLink: '일정 보기',
    viewTripAria: '{{destination}} 일정 보기',
    backToCommunity: '커뮤니티로 돌아가기',
    notFound: '해당 커뮤니티 일정을 찾을 수 없어요.',
  },
  en: {
    heading: 'Community',
    subheading: 'Browse trips other travelers have taken and use them for your own plan.',
    byAuthor: 'by {{author}}',
    likeAria: 'Like',
    likeAriaCancel: 'Unlike',
    likeButton: '❤ Like {{count}}',
    viewCount: '{{count}} views',
    viewTripLink: 'View Trip',
    viewTripAria: 'View {{destination}} trip',
    backToCommunity: 'Back to Community',
    notFound: 'This community trip could not be found.',
  },
  ja: {
    heading: 'コミュニティ',
    subheading: '他の旅行者が実際に旅したコースを見て、自分のプランの参考にしましょう。',
    byAuthor: '投稿者: {{author}}',
    likeAria: 'いいね',
    likeAriaCancel: 'いいねを取り消す',
    likeButton: '❤ いいね {{count}}',
    viewCount: '閲覧 {{count}}',
    viewTripLink: 'プランを見る',
    viewTripAria: '{{destination}}のプランを見る',
    backToCommunity: 'コミュニティに戻る',
    notFound: 'このコミュニティのプランが見つかりません。',
  },
}
