// 일정 상세 채팅에서 정규식 파서(chatIntent.ts)가 못 알아듣는 자유로운 말투("그럼 거기다
// 디즈니랜드도 넣어줘" 같은 대명사·생략이 섞인 문장)를 로컬 LLM(WebLLM)으로 해석하기 위한
// 모듈이다. LLM은 "이해"만 담당하고, 실제 일정 변경은 항상 검증된 결정론적 함수
// (generatePlan.ts의 addNamedActivity/removeActivity/applyWeatherAdjustment)가 수행한다 —
// 그래야 모델이 이상한 값을 뱉어도 일정 데이터 자체는 항상 유효한 상태를 유지한다.
import type { ChatCompletionMessage } from './aiEngine'
import type { WeatherKeyword } from './chatIntent'
import type { TripItinerary } from './tripPlan'

export type TripChatAction =
  | { action: 'add_activity'; day: number; activity: string }
  | { action: 'remove_activity'; day: number; activity: string }
  | { action: 'weather'; day: number; weather: WeatherKeyword }
  | { action: 'unknown' }

const WEATHER_VALUES: readonly WeatherKeyword[] = [
  'rain',
  'snow',
  'storm',
  'dust',
  'heat',
  'cold',
  'clear',
  'outdoor',
]

// 사용자는 한국어/영어/일본어 중 어떤 언어로도 메시지를 보낼 수 있다. 시스템 프롬프트를 특정
// 언어로 고정하면 모델이 그 언어에만 반응하도록 편향될 수 있어, 지시문 자체는 언어 중립적인
// 영어로 쓰고 "사용자 메시지가 어떤 언어든 이해하라"를 명시한다. 필드/enum 이름은 원래도 영어라
// 이 프롬프트를 이해하는 모델이라면 응답 형식은 그대로 지킨다.
const ACTION_SCHEMA = `The user's message may be written in Korean, English, or Japanese. Understand it regardless of language, then output exactly one of the following actions as a single JSON object. Never output explanatory text.

{ "action": "add_activity", "day": <day number>, "activity": <name of the activity to add> }
{ "action": "remove_activity", "day": <day number>, "activity": <name of the activity to remove, chosen from the names actually listed under "Current itinerary" below> }
{ "action": "weather", "day": <day number>, "weather": one of "rain" | "snow" | "storm" | "dust" | "heat" | "cold" | "clear" | "outdoor" }
{ "action": "unknown" }

- If the request asks to add an activity to the itinerary, use add_activity.
- If the request asks to remove an activity from the itinerary, use remove_activity.
- If the request asks to change the itinerary because of weather, use weather ("clear" for sunny/fine weather, "outdoor" for a request to switch back to outdoor activities).
- If the request refers to a day or activity mentioned earlier in the conversation using a pronoun (e.g. "there", "it"), infer it from the conversation context.
- If the intent is not clear, always answer unknown.`

/**
 * 매 호출마다 현재 일정 스냅샷을 시스템 프롬프트에 새로 채워 넣는다 — 활동이 추가/삭제될 때마다
 * "현재 일정" 목록이 최신 상태를 반영해야, "그거 빼줘" 같은 대명사 지시도 정확히 풀린다.
 */
export function buildTripChatSystemPrompt(itinerary: TripItinerary): string {
  const scheduleSummary = itinerary.days
    .map((day) => `${day.day}일차: ${day.activities.join(', ') || '(활동 없음)'}`)
    .join('\n')

  return `You are an assistant that helps edit a trip itinerary.\n\nCurrent itinerary:\n${scheduleSummary}\n\n${ACTION_SCHEMA}`
}

/** 모델이 뱉은 원문 문자열을 검증된 TripChatAction으로 바꾼다. 형식이 조금이라도 어긋나면 null. */
export function parseTripChatActionJson(raw: string): TripChatAction | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as Record<string, unknown>

  if (obj.action === 'add_activity' && typeof obj.day === 'number' && typeof obj.activity === 'string' && obj.activity) {
    return { action: 'add_activity', day: obj.day, activity: obj.activity }
  }

  if (obj.action === 'remove_activity' && typeof obj.day === 'number' && typeof obj.activity === 'string' && obj.activity) {
    return { action: 'remove_activity', day: obj.day, activity: obj.activity }
  }

  if (
    obj.action === 'weather' &&
    typeof obj.day === 'number' &&
    typeof obj.weather === 'string' &&
    WEATHER_VALUES.includes(obj.weather as WeatherKeyword)
  ) {
    return { action: 'weather', day: obj.day, weather: obj.weather as WeatherKeyword }
  }

  if (obj.action === 'unknown') {
    return { action: 'unknown' }
  }

  return null
}

export type TripChatCompleteFn = (messages: ChatCompletionMessage[]) => Promise<string>

// 15초 → 4초를 거쳐 1초까지 줄였다. 가상 GPU를 거치는 환경에서 실제로 써보니 몇 초만 기다려도
// 사용자에게는 "화면이 멈췄다"로 느껴졌다. 서버 LLM으로 옮기면 빠르고 안정적이겠지만 비용이
// 발생하니 그건 선택지에서 제외하고, 대신 로컬 모델은 그대로 유지하되 최대한 빨리 포기하도록
// 했다 — 1초 안에 응답이 없으면 그냥 규칙 기반 안내 문구로 넘어간다. 느린 환경에서는 AI 경로가
// 거의 항상 시간 초과로 끝난다는 뜻이지만(사실상 정규식 커버리지에 더 의존하게 됨), 적어도
// "멈춘 것처럼" 보이지는 않는다는 트레이드오프다.
const AI_ACTION_TIMEOUT_MS = 1000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('AI 응답이 너무 오래 걸려요.')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * 시스템 프롬프트(현재 일정 + 행동 스키마) + 이전 대화 몇 턴 + 이번 메시지를 모델에 보내고,
 * 결과를 구조화된 행동으로 파싱한다. 모델 호출이 실패하거나, 시간이 오래 걸리거나, 응답을
 * 알아볼 수 없는 형식이면 전부 { action: 'unknown' }으로 안전하게 수렴한다 — 호출부는 이 경우
 * 규칙 기반 안내 문구로 자연스럽게 폴백할 수 있다.
 */
export async function resolveTripChatActionWithAi(
  message: string,
  itinerary: TripItinerary,
  priorMessages: ChatCompletionMessage[],
  complete: TripChatCompleteFn,
): Promise<TripChatAction> {
  const messages: ChatCompletionMessage[] = [
    { role: 'system', content: buildTripChatSystemPrompt(itinerary) },
    ...priorMessages,
    { role: 'user', content: message },
  ]

  let raw: string
  try {
    raw = await withTimeout(complete(messages), AI_ACTION_TIMEOUT_MS)
  } catch {
    return { action: 'unknown' }
  }

  return parseTripChatActionJson(raw) ?? { action: 'unknown' }
}
