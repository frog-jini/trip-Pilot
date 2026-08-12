import type { Language } from '../language'

// /destinations 화면. 목적지 이름·장소 데이터(destinationCatalog.ts)는 데이터 카탈로그라 번역 대상이
// 아니고, 검색 UI 자체의 문구만 여기 둔다.
export const destinationsDictionary: Record<Language, Record<string, string>> = {
  ko: {
    heading: '여행지 검색',
    subheading: '가고 싶은 국가나 도시를 검색하면 대표 관광지, 맛집, 쇼핑 장소를 볼 수 있어요.',
    searchLabel: '여행지 검색',
    searchPlaceholder: '예: 일본 도쿄',
    searchButton: '검색',
    createPlanButton: '이 여행지로 일정 만들기',
    favoriteAriaAdd: '{{label}} 즐겨찾기 추가',
    favoriteAriaRemove: '{{label}} 즐겨찾기 해제',
    noCatalog: '아직 준비된 여행지 정보가 없어요.',
    noCatalogHint: '아래 여행지 중에서 먼저 찾아보시겠어요?',
  },
  en: {
    heading: 'Destination Search',
    subheading: 'Search a country or city to see top attractions, restaurants, and shopping spots.',
    searchLabel: 'Search destination',
    searchPlaceholder: 'e.g. Tokyo, Japan',
    searchButton: 'Search',
    createPlanButton: 'Create a Plan for This Destination',
    favoriteAriaAdd: 'Add {{label}} to favorites',
    favoriteAriaRemove: 'Remove {{label}} from favorites',
    noCatalog: 'No information is available for this destination yet.',
    noCatalogHint: 'Would you like to try one of these destinations instead?',
  },
  ja: {
    heading: '旅行先検索',
    subheading: '行きたい国や都市を検索すると、代表的な観光地・グルメ・ショッピングスポットが見られます。',
    searchLabel: '旅行先検索',
    searchPlaceholder: '例: 日本 東京',
    searchButton: '検索',
    createPlanButton: 'この旅行先でプランを作成',
    favoriteAriaAdd: '{{label}}をお気に入りに追加',
    favoriteAriaRemove: '{{label}}をお気に入りから解除',
    noCatalog: 'この旅行先の情報はまだ準備されていません。',
    noCatalogHint: '下の旅行先から先に探してみますか?',
  },
}
