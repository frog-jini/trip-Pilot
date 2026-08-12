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

const STYLE_ACTIVITIES: Record<TravelStyle, string[]> = {
  '관광 중심': [
    '대표 랜드마크 관광',
    '전망대에서 도시 전경 감상',
    '역사 박물관 관광',
    '유명 사원 관광',
    '구시가지 골목 탐방',
    '유명 광장 사진 명소 관광',
  ],
  '맛집 중심': [
    '현지 맛집 탐방',
    '전통 시장 맛집 투어',
    '유명 맛집 저녁 식사',
    '로컬 맛집 브런치',
    '노포 맛집 탐방',
    '디저트 카페 투어',
  ],
  '쇼핑 중심': [
    '대형 쇼핑몰 쇼핑',
    '아울렛 쇼핑',
    '쇼핑 거리 구경',
    '편집숍 쇼핑 투어',
    '로컬 브랜드 쇼핑',
    '기념품 거리 쇼핑',
  ],
  '힐링 여행': [
    '스파에서 힐링',
    '공원 산책하며 힐링',
    '해변에서 여유로운 힐링',
    '온천에서 힐링',
    '루프탑 카페에서 힐링',
    '요가·명상 클래스로 힐링',
  ],
  '가족 여행': [
    '테마파크 가족 나들이',
    '아쿠아리움 가족 관람',
    '가족 액티비티 체험',
    '동물원 가족 나들이',
    '키즈 카페 나들이',
    '가족 사진 스팟 나들이',
  ],
  '커플 여행': [
    '야경 명소 커플 데이트',
    '커플 스파 체험',
    '루프탑 바 커플 데이트',
    '분위기 좋은 레스토랑 커플 저녁',
    '커플 액티비티 체험',
    '기념품 숍 커플 데이트',
  ],
  '혼자 여행': [
    '한적한 카페에서 혼자만의 시간',
    '나만의 산책 코스',
    '독립서점 혼자 탐방',
    '조용한 미술관 혼자 관람',
    '혼자 즐기는 로컬 맛집',
    '한적한 공원 산책',
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

function parseMustVisit(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((place) => place.trim())
    .filter(Boolean)
}

// dayIndex만큼 풀 안에서 시작 위치를 밀어서 뽑는다 — 그래야 여러 날에 걸쳐 같은 스타일이어도
// 매일 다른 활동이 나오고, 풀을 다 쓰면(%) 자연스럽게 처음부터 순환한다.
function activitiesForStyleOnDay(style: TravelStyle, dayIndex: number, destination: string): string[] {
  const pool = getStylePool(style, destination)
  const count = Math.min(ACTIVITIES_PER_STYLE_PER_DAY, pool.length)
  return Array.from({ length: count }, (_, k) => pool[(dayIndex + k) % pool.length])
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

  const days: DayPlan[] = Array.from({ length: dayCount }, (_, index) => {
    const dayNumber = index + 1
    const styleActivities = values.styles.flatMap((style) =>
      activitiesForStyleOnDay(style, index, values.destination),
    )
    const activities = dayNumber === 1 ? [...mustVisitPlaces, ...styleActivities] : styleActivities

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

/** Appends one more day after the itinerary's current last day — lets a trip grow past the day count implied by its selected duration. */
export function addDay(
  itinerary: TripItinerary,
  values: TripPlanFormValues,
  history: ActivityHistory,
): AddDayResult {
  const dayNumber = itinerary.days.length + 1
  const activities = values.styles.flatMap((style) =>
    activitiesForStyleOnDay(style, itinerary.days.length, itinerary.destination),
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

// 선택된 스타일들을 순서대로 훑으며, 이 날 아직 한 번도 안 보여준 활동을 찾는다. 삭제·활동추가
// 양쪽에서 "빈 자리를 뭘로 채울지" 정하는 데 공통으로 쓰인다.
function findReplacementActivity(
  styles: TravelStyle[],
  destination: string,
  everShown: string[],
): string | null {
  for (const style of styles) {
    const candidate = getStylePool(style, destination).find((activity) => !everShown.includes(activity))
    if (candidate) return candidate
  }
  return null
}

const ALL_STYLES = Object.keys(STYLE_ACTIVITIES) as TravelStyle[]
// 실외 판별은 지금은 활동 하나하나가 아니라 "어느 스타일 풀에 속하는가"로만 정교화되어 있다 —
// 관광/가족 스타일 활동은 실외로, 나머지는 실내로 간주하는 단순화. WX-04 참고(더 정교한 태깅은 미구현).
const OUTDOOR_STYLES = new Set<TravelStyle>(['관광 중심', '가족 여행'])
const INDOOR_STYLE_PRIORITY: TravelStyle[] = ['쇼핑 중심', '맛집 중심', '힐링 여행', '혼자 여행', '커플 여행']

// 활동 문구가 어느 스타일 풀에서 왔는지 역으로 찾는다 — activityCost/activityTime처럼 활동을
// "이름"으로만 다루는 다른 모듈들과 달리, 여기서는 그 이름이 실외인지 판단하려고 스타일이 필요하다.
export function findStyleForActivity(activity: string, destination: string): TravelStyle | null {
  return ALL_STYLES.find((style) => getStylePool(style, destination).includes(activity)) ?? null
}

function isOutdoorActivity(activity: string, destination: string): boolean {
  const style = findStyleForActivity(activity, destination)
  return style !== null && OUTDOOR_STYLES.has(style)
}

// 실내 스타일 중에서도 우선순위를 둔다(쇼핑 > 맛집 > 힐링 > 혼자 > 커플) — 비 오는 날 대체 활동으로
// 쇼핑몰이 가장 자연스럽다고 보고 먼저 시도하는 것.
function findIndoorReplacement(destination: string, everShown: string[]): string | null {
  for (const style of INDOOR_STYLE_PRIORITY) {
    const candidate = getStylePool(style, destination).find((activity) => !everShown.includes(activity))
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

  const nextActivities = targetDay.activities.map((activity) => {
    if (!isOutdoorActivity(activity, itinerary.destination)) return activity

    const replacement = findIndoorReplacement(itinerary.destination, everShown)
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

  const days = itinerary.days.map((d) => {
    if (d.day !== day) return d

    const remaining = d.activities.filter((a) => a !== activity)
    const replacement = findReplacementActivity(values.styles, itinerary.destination, everShown)
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

/** Picks an activity from the combined pool of the selected styles, cycling back through it once every unique entry has already been used — so a day is never blocked purely for running out of fresh names. */
function pickCyclicActivity(styles: TravelStyle[], destination: string, index: number): string | null {
  const pool = styles.flatMap((style) => getStylePool(style, destination))
  if (pool.length === 0) return null
  return pool[index % pool.length]
}

export interface AddActivityResult {
  itinerary: TripItinerary
  addedActivity: string | null
  history: ActivityHistory
  /** True when the day is as full as its simulated schedule allows (the next slot would land past midnight). */
  reachedDailyLimit: boolean
}

/**
 * Appends one more AI-suggested activity to the given day, without removing any existing ones.
 * Keeps working past the size of the unique style pool by cycling back through it, and only
 * stops once the day's simulated schedule (see scheduleTime.ts) would spill into the next
 * calendar day — reported via `reachedDailyLimit` so the UI can explain why it stopped.
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

  const addedActivity =
    findReplacementActivity(values.styles, itinerary.destination, dayHistory) ??
    pickCyclicActivity(values.styles, itinerary.destination, nextIndex)

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

/** Concrete alternatives the user can pick from to replace a specific activity. */
export function getSwapOptions(
  destination: string,
  activity: string,
  everShown: string[],
  limit = 3,
): string[] {
  const style = findStyleForActivity(activity, destination)
  if (!style) return []

  const shown = everShown.includes(activity) ? everShown : [...everShown, activity]
  return getStylePool(style, destination)
    .filter((candidate) => !shown.includes(candidate))
    .slice(0, limit)
}

export interface SelectActivityResult {
  itinerary: TripItinerary
  history: ActivityHistory
}

/** Directly swaps in the exact place the user chose (as opposed to an automatic AI pick). */
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
