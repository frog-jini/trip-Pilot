// 일정 관련 핵심 타입 정의. TripPlanFormValues는 "사용자가 입력한 조건"(폼/챗 공용),
// TripItinerary는 "AI가 만든 결과물"이다 — 여러 lib/pages 파일이 공통으로 이 타입들을 가져다 쓴다.
export const DURATION_OPTIONS = ['1박 2일', '2박 3일', '3박 4일', '4박 5일', '5박 6일'] as const
export type Duration = (typeof DURATION_OPTIONS)[number]

// 저장되는 값(폼 입력·DB의 itinerary.duration)은 항상 이 한국어 문자열 그대로다 — 화면에 보여줄
// 때만 i18n 번역 키로 바꿔서 쓴다(DURATION_LABEL_KEYS[duration]을 useLanguage().t()에 넘기면 됨).
export const DURATION_LABEL_KEYS: Record<Duration, string> = {
  '1박 2일': 'plan.duration1n2d',
  '2박 3일': 'plan.duration2n3d',
  '3박 4일': 'plan.duration3n4d',
  '4박 5일': 'plan.duration4n5d',
  '5박 6일': 'plan.duration5n6d',
}

export const STYLE_OPTIONS = [
  '관광 중심',
  '맛집 중심',
  '쇼핑 중심',
  '힐링 여행',
  '가족 여행',
  '커플 여행',
  '혼자 여행',
] as const
export type TravelStyle = (typeof STYLE_OPTIONS)[number]

// Duration과 같은 이유로 저장값은 한국어 canonical 그대로 두고, 표시할 때만 번역 키로 바꾼다.
export const STYLE_LABEL_KEYS: Record<TravelStyle, string> = {
  '관광 중심': 'plan.styleSightseeing',
  '맛집 중심': 'plan.styleFood',
  '쇼핑 중심': 'plan.styleShopping',
  '힐링 여행': 'plan.styleRelaxing',
  '가족 여행': 'plan.styleFamily',
  '커플 여행': 'plan.styleCouple',
  '혼자 여행': 'plan.styleSolo',
}

// 커뮤니티 게시글 태그(trip.tag)는 보통 TravelStyle 값이지만, 스타일을 하나도 안 고르고 공유한
// 경우엔 고정 문구('나만의 여행')로 대체된다(TripDetailPage.handleTogglePublish 참고) — 그래서
// 둘 다 처리하는 별도 함수가 필요하다.
export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export function translateStyleTag(tag: string, t: TranslateFn): string {
  const styleKey = STYLE_LABEL_KEYS[tag as TravelStyle]
  if (styleKey) return t(styleKey)
  if (tag === '나만의 여행') return t('plan.customTag')
  return tag
}

export interface TripPlanFormValues {
  destination: string
  duration: Duration
  travelers: string
  budget: string
  accommodation: string
  styles: TravelStyle[]
  mustVisit: string
  startDate: string
}

export const emptyTripPlanFormValues: TripPlanFormValues = {
  destination: '',
  duration: '2박 3일',
  travelers: '',
  budget: '',
  accommodation: '',
  styles: [],
  mustVisit: '',
  startDate: '',
}

export interface DayPlan {
  day: number
  title: string
  activities: string[]
  date?: string
}

export interface TripItinerary {
  destination: string
  duration: Duration
  travelers: number
  budget: number
  days: DayPlan[]
}
