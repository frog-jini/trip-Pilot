import type { Language } from '../language'

// /favorites 화면.
export const favoritesDictionary: Record<Language, Record<string, string>> = {
  ko: {
    heading: '즐겨찾기',
    subheading: '마음에 드는 장소를 모아뒀어요.',
    emptyMessage: '아직 즐겨찾기한 장소가 없어요.',
    goCreateButton: '여행 일정 만들러 가기',
    removeAria: '{{activity}} 즐겨찾기 해제',
  },
  en: {
    heading: 'Favorites',
    subheading: 'Places you’ve saved.',
    emptyMessage: 'You haven’t favorited any places yet.',
    goCreateButton: 'Go Create a Trip',
    removeAria: 'Remove {{activity}} from favorites',
  },
  ja: {
    heading: 'お気に入り',
    subheading: '気に入った場所を集めました。',
    emptyMessage: 'まだお気に入りの場所がありません。',
    goCreateButton: 'プランを作成しに行く',
    removeAria: '{{activity}}をお気に入りから解除',
  },
}
