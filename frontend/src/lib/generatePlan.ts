import { addDaysIso } from './dateUtils'
import { getCatalogPlaces } from './destinationCatalog'
import { isBeforeNextMidnight } from './scheduleTime'
import {
  DURATION_OPTIONS,
  type DayPlan,
  type TravelStyle,
  type TripItinerary,
  type TripPlanFormValues,
} from './tripPlan'

const ACTIVITIES_PER_STYLE_PER_DAY = 3

// 스타일별 범용 활동 문구. 카탈로그 미등록 목적지의 기본 풀이자, 카탈로그가 있는 목적지에서도
// 여행 일수가 많아 실제 장소가 모자랄 때 뒤에 이어붙이는 예비 풀(getExtendedStylePool 참고).
// 하루 3개 × 최장 6일 = 18개를 한 스타일만 골라도 중복 없이 채울 수 있도록 스타일마다 18개씩 둔다.
const STYLE_ACTIVITIES: Record<TravelStyle, string[]> = {
  '관광 중심': [
    '대표 랜드마크 관광',
    '전망대에서 도시 전경 감상',
    '역사 박물관 관광',
    '유명 사원 관광',
    '구시가지 골목 탐방',
    '유명 광장 사진 명소 관광',
    '현지 전통 마을 관광',
    '국립 미술관 관광',
    '왕궁·궁전 관광',
    '대성당 관광',
    '케이블카 타고 전망 관광',
    '야경 명소 관광',
    '테마 거리 관광',
    '고대 유적지 관광',
    '현대 건축물 관광',
    '전통 재래시장 구경',
    '강변 산책로 관광',
    '언덕 전망 포인트 관광',
  ],
  '맛집 중심': [
    '현지 맛집 탐방',
    '전통 시장 맛집 투어',
    '유명 맛집 저녁 식사',
    '로컬 맛집 브런치',
    '노포 맛집 탐방',
    '디저트 카페 투어',
    '미쉐린 맛집 점심',
    '현지인 추천 밥집 방문',
    '길거리 음식 투어',
    '유명 베이커리 방문',
    '전통 찻집 방문',
    '야시장 먹거리 투어',
    '해산물 전문점 점심',
    '현지 가정식 체험',
    '유명 카페 브런치',
    '수제 맥주 펍 방문',
    '전통 디저트 맛보기',
    '푸드코트 탐방',
  ],
  '쇼핑 중심': [
    '대형 쇼핑몰 쇼핑',
    '아울렛 쇼핑',
    '쇼핑 거리 구경',
    '편집숍 쇼핑 투어',
    '로컬 브랜드 쇼핑',
    '기념품 거리 쇼핑',
    '백화점 쇼핑',
    '전통 시장 쇼핑',
    '서점·문구 쇼핑',
    '빈티지 숍 쇼핑',
    '디자인 소품 쇼핑',
    '면세점 쇼핑',
    '지하상가 쇼핑',
    '골목 소품숍 쇼핑',
    '대형 마트 쇼핑',
    '레코드숍 쇼핑',
    '수공예 시장 쇼핑',
    '스니커즈 편집숍 쇼핑',
  ],
  '힐링 여행': [
    '스파에서 힐링',
    '공원 산책하며 힐링',
    '해변에서 여유로운 힐링',
    '온천에서 힐링',
    '루프탑 카페에서 힐링',
    '요가·명상 클래스로 힐링',
    '식물원 산책하며 힐링',
    '호숫가에서 힐링',
    '미술관 카페에서 힐링',
    '족욕·반신욕으로 힐링',
    '숲길 트레킹으로 힐링',
    '일몰 감상하며 힐링',
    '전통 정원에서 힐링',
    '강가 카페에서 힐링',
    '해안 산책로 걸으며 힐링',
    '노을 감상하며 힐링',
    '북카페에서 힐링',
    '아침 요가로 힐링',
  ],
  '가족 여행': [
    '테마파크 가족 나들이',
    '아쿠아리움 가족 관람',
    '가족 액티비티 체험',
    '동물원 가족 나들이',
    '키즈 카페 나들이',
    '가족 사진 스팟 나들이',
    '과학관 가족 관람',
    '박물관 가족 체험',
    '전망대 가족 나들이',
    '대형 공원 가족 피크닉',
    '목장 체험 가족 나들이',
    '실내 놀이시설 가족 나들이',
    '식물원 가족 나들이',
    '기차 체험 가족 나들이',
    '실내 클라이밍 가족 체험',
    '농장 체험 가족 나들이',
    '민속촌 가족 나들이',
    '전망 타워 가족 관람',
  ],
  '커플 여행': [
    '야경 명소 커플 데이트',
    '커플 스파 체험',
    '루프탑 바 커플 데이트',
    '분위기 좋은 레스토랑 커플 저녁',
    '커플 액티비티 체험',
    '기념품 숍 커플 데이트',
    '전망 카페 커플 데이트',
    '미술관 커플 관람',
    '강변 산책 커플 데이트',
    '노을 명소 커플 사진',
    '디저트 맛집 커플 데이트',
    '플리마켓 커플 구경',
    '재즈 바 커플 데이트',
    '전망 산책로 커플 데이트',
    '공방 클래스 커플 체험',
    '벼룩시장 커플 구경',
    '해변 노을 커플 데이트',
    '전통찻집 커플 데이트',
  ],
  '혼자 여행': [
    '한적한 카페에서 혼자만의 시간',
    '나만의 산책 코스',
    '독립서점 혼자 탐방',
    '조용한 미술관 혼자 관람',
    '혼자 즐기는 로컬 맛집',
    '한적한 공원 산책',
    '골목 카페 혼자 탐방',
    '현지 도서관 방문',
    '전시회 혼자 관람',
    '재래시장 혼자 구경',
    '강변 자전거 라이딩',
    '전망 언덕 혼자 산책',
    '로컬 서점 혼자 탐방',
    '사진 스팟 혼자 나들이',
    '오래된 골목 혼자 산책',
    '수변공원 혼자 산책',
    '작은 갤러리 혼자 관람',
    '동네 시장 혼자 구경',
  ],
}

// 목적지가 destinationCatalog.ts에 등록돼 있으면 그 실제 장소들을, 없으면 스타일별 범용 활동
// 문구(STYLE_ACTIVITIES)를 쓴다 — 등록 안 된 도시를 입력해도 일정 생성 자체는 항상 가능해야 하기 때문.
function getStylePool(style: TravelStyle, destination: string): string[] {
  const catalogPlaces = getCatalogPlaces(destination, style)
  if (catalogPlaces.length > 0) {
    return catalogPlaces.map((place) => `${place.name} (${place.area})`)
  }
  return STYLE_ACTIVITIES[style]
}

// 여러 날에 걸쳐 활동을 뽑을 때 쓰는 "확장 풀". 카탈로그가 있는 목적지는 실제 장소를 먼저 쓰되,
// 그 장소들(스타일당 6개)만으로는 긴 일정에서 금방 바닥나 같은 곳을 다시 추천하게 되므로, 뒤에
// 범용 활동 문구를 이어붙여 후보 폭을 넓힌다. 카탈로그가 없으면 이미 범용 풀이라 그대로 쓴다.
function getExtendedStylePool(style: TravelStyle, destination: string): string[] {
  const primary = getStylePool(style, destination)
  if (primary === STYLE_ACTIVITIES[style]) return primary
  return [...primary, ...STYLE_ACTIVITIES[style]]
}

function parseMustVisit(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((place) => place.trim())
    .filter(Boolean)
}

// dayIndex번째 날에 이 스타일로 추천할 활동을 고른다. 풀의 dayIndex*count 지점부터 한 바퀴
// 돌면서 "아직 이 일정에 안 쓴" 활동만 count개까지 모으고, 고른 항목은 used에 등록한다 —
// 같은 장소가 여러 스타일 풀에 동시에 속하거나(예: 시장 = 맛집이자 쇼핑), 여러 날에 걸쳐도
// 절대 두 번 추천되지 않는다. 풀을 다 써서 더 못 고르면 그 스타일은 그날 자리를 비운다.
function takeFreshActivities(
  style: TravelStyle,
  dayIndex: number,
  destination: string,
  used: Set<string>,
): string[] {
  const pool = getExtendedStylePool(style, destination)
  const count = Math.min(ACTIVITIES_PER_STYLE_PER_DAY, pool.length)
  const picked: string[] = []
  for (let step = 0; step < pool.length && picked.length < count; step++) {
    const candidate = pool[(dayIndex * count + step) % pool.length]
    if (used.has(candidate)) continue
    used.add(candidate)
    picked.push(candidate)
  }
  return picked
}

function dateForDayIndex(startDate: string | undefined, dayIndex: number): string | undefined {
  return startDate ? addDaysIso(startDate, dayIndex) : undefined
}

// 일정 생성의 핵심 진입점. 생성형 AI가 아니라 결정론적 규칙 엔진이다 — 같은 입력이면 항상 같은
// 일정이 나온다. "N박 M일"은 DURATION_OPTIONS 안에서의 인덱스로 일수(dayCount = 인덱스+2)를
// 계산하고, 필수 방문지는 1일차에만 최우선으로 꽂아 넣는다(사용자가 "꼭 가고싶다"고 한 곳이니).
export function generatePlan(values: TripPlanFormValues): TripItinerary {
  const dayCount = DURATION_OPTIONS.indexOf(values.duration) + 2
  const mustVisitPlaces = parseMustVisit(values.mustVisit)
  // 이 필드가 생기기 전에 만들어진 트립은 값 자체가 없을 수 있으니 ?? {}로 방어한다(tripPlan.ts 참고).
  const dayMustVisit = values.dayMustVisit ?? {}

  // 일정 전체에서 한 번 등장한 활동은 다시 넣지 않기 위한 집합. 필수 방문지도 미리 넣어둬서
  // 스타일 추천이 같은 곳을 중복 제안하지 않게 한다 — dayMustVisit도 어느 일차의 것이든 여기
  // 미리 다 넣어둬야, 예컨대 2일차에 콕 집어 말한 곳을 스타일 추천이 다른 날에 또 추천하지 않는다.
  const used = new Set<string>([...mustVisitPlaces, ...Object.values(dayMustVisit).flat()])

  const days: DayPlan[] = Array.from({ length: dayCount }, (_, index) => {
    const dayNumber = index + 1
    const styleActivities = values.styles.flatMap((style) =>
      takeFreshActivities(style, index, values.destination, used),
    )
    // 자유 텍스트 mustVisit은 1일차에만, 일차별 dayMustVisit은 해당 일차에 꽂아 넣는다 —
    // 1일차는 둘 다 해당되면 둘 다(mustVisit 먼저) 앞에 붙는다.
    const dayMustVisitPlaces = dayMustVisit[dayNumber] ?? []
    const activities = [...(dayNumber === 1 ? mustVisitPlaces : []), ...dayMustVisitPlaces, ...styleActivities]

    return {
      day: dayNumber,
      title: `${dayNumber}일차`,
      activities,
      date: dateForDayIndex(values.startDate, index),
    }
  })

  return {
    destination: values.destination,
    duration: values.duration,
    travelers: Number(values.travelers) || 0,
    budget: Number(values.budget) || 0,
    days,
  }
}

export interface AddDayResult {
  itinerary: TripItinerary
  history: ActivityHistory
}

/** 일정의 현재 마지막 날 뒤에 하루를 더 붙인다 — 처음 고른 여행 기간보다 일정을 늘릴 수 있게 해준다. */
export function addDay(
  itinerary: TripItinerary,
  values: TripPlanFormValues,
  history: ActivityHistory,
): AddDayResult {
  const dayNumber = itinerary.days.length + 1
  // 기존 모든 날에 이미 나온 활동은 제외하고 새 날을 채운다(중복 추천 방지).
  const used = new Set<string>(Object.values(history).flat())
  const activities = values.styles.flatMap((style) =>
    takeFreshActivities(style, itinerary.days.length, itinerary.destination, used),
  )

  const newDay: DayPlan = {
    day: dayNumber,
    title: `${dayNumber}일차`,
    activities,
    date: dateForDayIndex(values.startDate, itinerary.days.length),
  }

  return {
    itinerary: { ...itinerary, days: [...itinerary.days, newDay] },
    history: { ...history, [dayNumber]: [...activities] },
  }
}

export type ActivityHistory = Record<number, string[]>

// 초기 이력 = 지금 보이는 활동들 그 자체. 이후 삭제/추가/날씨조정으로 노출되는 활동은 여기 계속
// 누적돼서, "이미 한번 보여준 활동은 같은 날에 다시 추천하지 않는다"는 규칙을 지킬 수 있게 한다.
export function createActivityHistory(itinerary: TripItinerary): ActivityHistory {
  return Object.fromEntries(itinerary.days.map((d) => [d.day, [...d.activities]]))
}

export interface RemoveActivityResult {
  itinerary: TripItinerary
  addedActivity: string | null
  history: ActivityHistory
}

// 대체·보충 활동을 고를 때 후보에서 빼야 하는, "지금 일정의 모든 날에 이미 올라가 있는 활동".
// 이게 없으면 1일차에 있는 장소가 2일차 빈자리를 메우면서 날짜 간 중복이 생긴다.
function placedActivities(itinerary: TripItinerary): string[] {
  return itinerary.days.flatMap((d) => d.activities)
}

// 선택된 스타일들을 순서대로 훑으며, 아직 한 번도 안 쓴(everShown에 없는) 활동을 찾는다. 삭제·활동추가
// 양쪽에서 "빈 자리를 뭘로 채울지" 정하는 데 공통으로 쓰인다. everShown에는 그 날 이력뿐 아니라
// 다른 날에 이미 배치된 활동(placedActivities)까지 합쳐 넘겨야 날짜 간 중복이 안 생긴다.
function findReplacementActivity(
  styles: TravelStyle[],
  destination: string,
  everShown: string[],
): string | null {
  for (const style of styles) {
    const candidate = getExtendedStylePool(style, destination).find((activity) => !everShown.includes(activity))
    if (candidate) return candidate
  }
  return null
}

/**
 * 채팅 "추천해줘" 의도(TripDetailPage.applyRecommend)에서 쓰는 제안 생성기. findReplacementActivity가
 * "빈 자리 하나"를 채울 후보 하나만 찾는 것과 달리, 이건 화면에 그냥 보여줄 몇 개(count)를 한 번에
 * 모은다 — 선택된 스타일들의 확장 풀을 전부 합친 뒤, 지금 일정 어디에도 없는 활동만 앞에서부터
 * 골라낸다. 같은 장소가 여러 스타일 풀에 동시에 속할 수 있어(예: 시장 = 맛집이자 쇼핑) 중복은
 * 제거해서 "추천 두 개"라고 해놓고 같은 이름이 두 번 나오는 일이 없게 한다.
 */
export function findRecommendations(
  styles: TravelStyle[],
  destination: string,
  everShown: string[],
  count = 2,
): string[] {
  const pool = styles.flatMap((style) => getExtendedStylePool(style, destination))
  const fresh = [...new Set(pool)].filter((activity) => !everShown.includes(activity))
  return fresh.slice(0, count)
}

const ALL_STYLES = Object.keys(STYLE_ACTIVITIES) as TravelStyle[]
// 실외 판별은 지금은 활동 하나하나가 아니라 "어느 스타일 풀에 속하는가"로만 정교화되어 있다 —
// 관광/가족 스타일 활동은 실외로, 나머지는 실내로 간주하는 단순화. WX-04 참고(더 정교한 태깅은 미구현).
const OUTDOOR_STYLES = new Set<TravelStyle>(['관광 중심', '가족 여행'])
const INDOOR_STYLE_PRIORITY: TravelStyle[] = ['쇼핑 중심', '맛집 중심', '힐링 여행', '혼자 여행', '커플 여행']

// 활동 문구가 어느 스타일 풀에서 왔는지 역으로 찾는다 — activityCost/activityTime처럼 활동을
// "이름"으로만 다루는 다른 모듈들과 달리, 여기서는 그 이름이 실외인지 판단하려고 스타일이 필요하다.
export function findStyleForActivity(activity: string, destination: string): TravelStyle | null {
  return ALL_STYLES.find((style) => getExtendedStylePool(style, destination).includes(activity)) ?? null
}

// 채팅에서 사용자가 말한 활동명(예: "디즈니랜드")은 카탈로그 활동의 실제 저장 표기(예: "도쿄
// 디즈니랜드 (우라야스)")와 글자 그대로 다른 경우가 많다 — getStylePool()이 카탈로그 장소 이름
// 뒤에 지역을 덧붙이기 때문. 그래서 삭제 같은 명령을 실행하기 전에 사용자가 말한 이름을 실제
// 저장된 이름으로 느슨하게 맞춰준다: 정확히 일치하면 그것을 최우선으로(기존 동작 유지), 아니면
// 저장된 이름이 사용자 표현을 부분 포함하면 그것을(가장 흔한 경우 — "디즈니랜드"가 "도쿄
// 디즈니랜드 (우라야스)"에 포함), 그것도 없으면 반대로 사용자 표현이 저장된 이름을 부분 포함하면
// 그것을(사용자가 더 구체적으로 말했거나, 추출 과정에서 잡소리가 섞여 들어온 경우) 순서로 찾는다.
export function findMatchingActivity(activities: string[], spoken: string): string | null {
  const exact = activities.find((activity) => activity === spoken)
  if (exact) return exact

  const normalizedSpoken = spoken.trim().toLowerCase()
  const containsSpoken = activities.find((activity) => activity.toLowerCase().includes(normalizedSpoken))
  if (containsSpoken) return containsSpoken

  const containedInSpoken = activities.find((activity) => normalizedSpoken.includes(activity.toLowerCase()))
  if (containedInSpoken) return containedInSpoken

  return null
}

function isOutdoorActivity(activity: string, destination: string): boolean {
  const style = findStyleForActivity(activity, destination)
  return style !== null && OUTDOOR_STYLES.has(style)
}

// 실내 스타일 중에서도 우선순위를 둔다(쇼핑 > 맛집 > 힐링 > 혼자 > 커플) — 비 오는 날 대체 활동으로
// 쇼핑몰이 가장 자연스럽다고 보고 먼저 시도하는 것.
function findIndoorReplacement(destination: string, everShown: string[]): string | null {
  for (const style of INDOOR_STYLE_PRIORITY) {
    const candidate = getExtendedStylePool(style, destination).find((activity) => !everShown.includes(activity))
    if (candidate) return candidate
  }
  return null
}

export interface WeatherAdjustmentResult {
  itinerary: TripItinerary
  history: ActivityHistory
  changed: boolean
}

// 날씨 챗("n일차 비 온대")에서 호출된다. 그날의 실외 활동만 골라 실내 활동으로 교체하고,
// 바뀐 게 하나도 없으면 changed:false를 돌려줘서 호출부가 "이미 실내 위주라 그대로 뒀다"고
// 안내할 수 있게 한다(TripDetailPage.applyWeatherAction 참고).
export function applyWeatherAdjustment(
  itinerary: TripItinerary,
  day: number,
  history: ActivityHistory,
): WeatherAdjustmentResult {
  const targetDay = itinerary.days.find((d) => d.day === day)
  if (!targetDay) {
    return { itinerary, history, changed: false }
  }

  let everShown = history[day] ?? [...targetDay.activities]
  let changed = false
  // 다른 날에 이미 있는 활동으로 바꾸면 날짜 간 중복이 되므로 함께 제외한다.
  const otherDayActivities = itinerary.days
    .filter((d) => d.day !== day)
    .flatMap((d) => d.activities)

  const nextActivities = targetDay.activities.map((activity) => {
    if (!isOutdoorActivity(activity, itinerary.destination)) return activity

    const replacement = findIndoorReplacement(itinerary.destination, [...everShown, ...otherDayActivities])
    if (!replacement) return activity

    everShown = [...everShown, replacement]
    changed = true
    return replacement
  })

  if (!changed) {
    return { itinerary, history, changed: false }
  }

  const days = itinerary.days.map((d) => (d.day === day ? { ...d, activities: nextActivities } : d))
  const nextHistory: ActivityHistory = { ...history, [day]: everShown }

  return { itinerary: { ...itinerary, days }, history: nextHistory, changed: true }
}

// ✕ 버튼(및 채팅 "삭제해줘")의 핵심 로직. 그냥 지우기만 하지 않고, 같은 날 아직 안 보여준
// 활동으로 자동으로 채워 넣는다 — 그래야 하루 일정이 활동 하나 지운다고 휑해지지 않는다.
export function removeActivity(
  itinerary: TripItinerary,
  values: TripPlanFormValues,
  day: number,
  activity: string,
  history: ActivityHistory,
): RemoveActivityResult {
  let addedActivity: string | null = null
  const dayHistory = history[day] ?? itinerary.days.find((d) => d.day === day)?.activities ?? []
  const everShown = dayHistory.includes(activity) ? dayHistory : [...dayHistory, activity]
  // 그 날 이력 + 다른 날에 이미 배치된 활동을 모두 제외해야 날짜 간 중복 없이 빈자리를 채운다.
  const exclude = [...everShown, ...placedActivities(itinerary)]

  const days = itinerary.days.map((d) => {
    if (d.day !== day) return d

    const remaining = d.activities.filter((a) => a !== activity)
    const replacement = findReplacementActivity(values.styles, itinerary.destination, exclude)
    addedActivity = replacement

    return {
      ...d,
      activities: replacement ? [...remaining, replacement] : remaining,
    }
  })

  const nextHistory: ActivityHistory = {
    ...history,
    [day]: addedActivity ? [...everShown, addedActivity] : everShown,
  }

  return { itinerary: { ...itinerary, days }, addedActivity, history: nextHistory }
}

/** 선택한 스타일들을 합친 목록에서 활동 하나를 고른다. `exclude`(현재 일정에 이미 있는 것)에
 *  없는 항목을 우선하고, 겹치지 않는 항목을 다 쓴 뒤에야 처음으로 돌아가 중복을 허용한다 —
 *  그래서 이름이 바닥났다는 이유만으로 하루 일정이 막히는 일은 없다. */
function pickCyclicActivity(
  styles: TravelStyle[],
  destination: string,
  index: number,
  exclude: string[] = [],
): string | null {
  const pool = styles.flatMap((style) => getExtendedStylePool(style, destination))
  if (pool.length === 0) return null
  const fresh = pool.filter((activity) => !exclude.includes(activity))
  const source = fresh.length > 0 ? fresh : pool
  return source[index % source.length]
}

export interface AddActivityResult {
  itinerary: TripItinerary
  addedActivity: string | null
  history: ActivityHistory
  /** 시뮬레이션한 일정상 그날이 꽉 찼으면 true (다음 활동이 자정을 넘어가게 되는 경우). */
  reachedDailyLimit: boolean
}

/**
 * 기존 활동은 그대로 두고, 지정한 날에 AI 추천 활동을 하나 더 붙인다.
 * 스타일 목록의 고유 항목 수를 넘어서도 처음부터 다시 돌며 계속 추가하고, 그날의 시뮬레이션
 * 일정(scheduleTime.ts 참고)이 다음 날로 넘어가게 될 때만 멈춘다 — 이때 `reachedDailyLimit`으로
 * 알려서 화면에서 왜 멈췄는지 설명할 수 있게 한다.
 */
export function addActivity(
  itinerary: TripItinerary,
  values: TripPlanFormValues,
  day: number,
  history: ActivityHistory,
): AddActivityResult {
  const targetDay = itinerary.days.find((d) => d.day === day)
  const dayHistory = history[day] ?? targetDay?.activities ?? []
  const nextIndex = targetDay?.activities.length ?? 0

  if (!isBeforeNextMidnight(nextIndex)) {
    return { itinerary, addedActivity: null, history, reachedDailyLimit: true }
  }

  // 그 날 이력 + 다른 날에 이미 배치된 활동을 모두 제외해서, 여러 날에 걸쳐 중복되지 않게 한다.
  const exclude = [...dayHistory, ...placedActivities(itinerary)]
  const addedActivity =
    findReplacementActivity(values.styles, itinerary.destination, exclude) ??
    pickCyclicActivity(values.styles, itinerary.destination, nextIndex, exclude)

  if (!addedActivity) {
    return { itinerary, addedActivity: null, history, reachedDailyLimit: false }
  }

  const days = itinerary.days.map((d) =>
    d.day === day ? { ...d, activities: [...d.activities, addedActivity] } : d,
  )
  const nextHistory: ActivityHistory = { ...history, [day]: [...dayHistory, addedActivity] }

  return { itinerary: { ...itinerary, days }, addedActivity, history: nextHistory, reachedDailyLimit: false }
}

export interface AddNamedActivityResult {
  itinerary: TripItinerary
  history: ActivityHistory
  reachedDailyLimit: boolean
}

/**
 * addActivity()와 같은 일자 용량 규칙(자정 넘기지 않기)을 따르되, 카탈로그에서 자동으로 고르는 대신
 * 사용자가 채팅으로 직접 말한 활동명을 그대로 추가한다 — 예: "2일차에 디즈니랜드 추가해줘".
 */
export function addNamedActivity(
  itinerary: TripItinerary,
  day: number,
  activity: string,
  history: ActivityHistory,
): AddNamedActivityResult {
  const targetDay = itinerary.days.find((d) => d.day === day)
  const dayHistory = history[day] ?? targetDay?.activities ?? []
  const nextIndex = targetDay?.activities.length ?? 0

  if (!isBeforeNextMidnight(nextIndex)) {
    return { itinerary, history, reachedDailyLimit: true }
  }

  const days = itinerary.days.map((d) =>
    d.day === day ? { ...d, activities: [...d.activities, activity] } : d,
  )
  const nextHistory: ActivityHistory = {
    ...history,
    [day]: dayHistory.includes(activity) ? dayHistory : [...dayHistory, activity],
  }

  return { itinerary: { ...itinerary, days }, history: nextHistory, reachedDailyLimit: false }
}

/** 특정 활동을 바꿀 때 사용자가 고를 수 있는 구체적인 대안 목록. */
export function getSwapOptions(
  destination: string,
  activity: string,
  everShown: string[],
  limit = 3,
): string[] {
  const style = findStyleForActivity(activity, destination)
  if (!style) return []

  const shown = everShown.includes(activity) ? everShown : [...everShown, activity]
  return getExtendedStylePool(style, destination)
    .filter((candidate) => !shown.includes(candidate))
    .slice(0, limit)
}

export interface SelectActivityResult {
  itinerary: TripItinerary
  history: ActivityHistory
}

/** 사용자가 직접 고른 장소로 그대로 바꾼다 (AI가 자동으로 고르는 것과 반대). */
export function selectActivity(
  itinerary: TripItinerary,
  day: number,
  oldActivity: string,
  newActivity: string,
  history: ActivityHistory,
): SelectActivityResult {
  const days = itinerary.days.map((d) => {
    if (d.day !== day) return d
    return { ...d, activities: d.activities.map((a) => (a === oldActivity ? newActivity : a)) }
  })

  const dayHistory = history[day] ?? itinerary.days.find((d) => d.day === day)?.activities ?? []
  const nextHistory: ActivityHistory = {
    ...history,
    [day]: dayHistory.includes(newActivity) ? dayHistory : [...dayHistory, newActivity],
  }

  return { itinerary: { ...itinerary, days }, history: nextHistory }
}
