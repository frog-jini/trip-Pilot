// PlanChatPage(대화로 일정 만들기)의 두뇌. 정규식 기반 추출이 우선이고, 부족한 부분만 로컬 LLM이
// 보조한다(parseTripPlanMessageWithAi) — chatIntent.ts와 같은 "규칙 먼저, AI는 보너스" 철학이다.
import { DURATION_OPTIONS, STYLE_OPTIONS, type Duration, type TravelStyle, type TripPlanFormValues } from './tripPlan'
import { validateTripPlanForm, type TripPlanFormErrors } from './tripPlanValidation'
import { findCatalogKey } from './destinationCatalog'

function extractDestination(message: string): string | null {
  return findCatalogKey(message)
}

function extractDuration(message: string): Duration | null {
  const match = message.match(/(\d)\s*박\s*(\d)\s*일/)
  if (!match) return null

  const candidate = `${match[1]}박 ${match[2]}일`
  return (DURATION_OPTIONS as readonly string[]).includes(candidate) ? (candidate as Duration) : null
}

function extractTravelers(message: string): string | null {
  const match = message.match(/(\d+)\s*명/)
  return match ? match[1] : null
}

function extractBudget(message: string): string | null {
  const match = message.match(/(\d+)\s*만\s*원/)
  return match ? match[1] : null
}

const STYLE_KEYWORDS: [string[], TravelStyle][] = [
  [['관광'], '관광 중심'],
  [['맛집'], '맛집 중심'],
  [['쇼핑'], '쇼핑 중심'],
  [['힐링', '휴양'], '힐링 여행'],
  [['가족'], '가족 여행'],
  [['커플', '연인'], '커플 여행'],
  [['혼자', '나홀로'], '혼자 여행'],
]

function extractStyles(message: string): TravelStyle[] {
  return STYLE_KEYWORDS.filter(([keywords]) => keywords.some((keyword) => message.includes(keyword))).map(
    ([, style]) => style,
  )
}

export function parseTripPlanMessage(message: string, current: TripPlanFormValues): TripPlanFormValues {
  const destination = extractDestination(message)
  const duration = extractDuration(message)
  const travelers = extractTravelers(message)
  const budget = extractBudget(message)
  const newStyles = extractStyles(message)

  return {
    ...current,
    destination: destination ?? current.destination,
    duration: duration ?? current.duration,
    travelers: travelers ?? current.travelers,
    budget: budget ?? current.budget,
    styles: newStyles.length > 0 ? Array.from(new Set([...current.styles, ...newStyles])) : current.styles,
  }
}

interface AiExtractedFields {
  destination?: string | null
  duration?: string | null
  travelers?: string | null
  budget?: string | null
  styles?: string[] | null
}

const TRIP_PLAN_SYSTEM_PROMPT = `당신은 여행 일정 계획을 도와주는 assistant입니다.
사용자 메시지에서 알 수 있는 정보만 뽑아 아래 형식의 JSON 객체 하나만 출력하세요. 설명 문장은 절대 쓰지 마세요.

{
  "destination": string | null,
  "duration": "N박 M일" 형식의 문자열 (예: "2박 3일") | null,
  "travelers": 인원 수를 나타내는 숫자 문자열 (예: "2") | null,
  "budget": 만원 단위 예산을 나타내는 숫자 문자열 (예: "100") | null,
  "styles": ["관광 중심" | "맛집 중심" | "쇼핑 중심" | "힐링 여행" | "가족 여행" | "커플 여행" | "혼자 여행", ...]
}

메시지에서 알 수 없는 값은 null로 두고, styles는 언급되지 않았으면 빈 배열로 두세요.`

function parseAiJson(raw: string): AiExtractedFields | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as AiExtractedFields) : null
  } catch {
    return null
  }
}

function isValidDuration(value: unknown): value is Duration {
  return typeof value === 'string' && (DURATION_OPTIONS as readonly string[]).includes(value)
}

function isValidStyle(value: unknown): value is TravelStyle {
  return typeof value === 'string' && (STYLE_OPTIONS as readonly string[]).includes(value)
}

export type CompleteFn = (messages: { role: 'system' | 'user'; content: string }[]) => Promise<string>

// A local model's first response can be slow (cold compute, weak hardware), but it must
// never leave the user staring at a pending indicator forever — fall back past this point.
// Kept short because the AI is only ever a supplement now (see parseTripPlanMessageWithAi):
// the rule-based parser already ran first, so there's little value in waiting long on the AI.
const AI_COMPLETION_TIMEOUT_MS = 1000

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
 * Runs the fast, deterministic rule-based parser first — so clearly-formatted input (like
 * the example message) is always recognized instantly and reliably, no matter what happens
 * with the AI. Only calls out to an LLM (via the injected `complete` function) when the
 * rule-based pass left something required still missing, to try to understand free-form
 * phrasing the rule-based patterns can't catch. Falls back to the rule-based result whenever
 * the AI response is missing, unparsable, too slow, or the completion call itself fails —
 * so the rule-based recognition is never lost, only ever added to.
 */
export async function parseTripPlanMessageWithAi(
  message: string,
  current: TripPlanFormValues,
  complete: CompleteFn,
): Promise<TripPlanFormValues> {
  const ruleBased = parseTripPlanMessage(message, current)
  if (isTripPlanReady(ruleBased)) return ruleBased

  let raw: string
  try {
    raw = await withTimeout(
      complete([
        { role: 'system', content: TRIP_PLAN_SYSTEM_PROMPT },
        { role: 'user', content: message },
      ]),
      AI_COMPLETION_TIMEOUT_MS,
    )
  } catch {
    return ruleBased
  }

  const extracted = parseAiJson(raw)
  if (!extracted) return ruleBased

  const newStyles = Array.isArray(extracted.styles) ? extracted.styles.filter(isValidStyle) : []

  return {
    ...ruleBased,
    destination: extracted.destination || ruleBased.destination,
    duration: isValidDuration(extracted.duration) ? extracted.duration : ruleBased.duration,
    travelers: extracted.travelers || ruleBased.travelers,
    budget: extracted.budget || ruleBased.budget,
    styles: newStyles.length > 0 ? Array.from(new Set([...ruleBased.styles, ...newStyles])) : ruleBased.styles,
  }
}

// 문구 자체가 아니라 i18n 번역 키를 돌려준다 — validation.ts/tripPlanValidation.ts와 같은 패턴.
// 실제 문구로 바꾸는 건 이 함수를 호출하는 화면(PlanChatPage)이 useLanguage().t(key)로 담당한다.
const REQUIRED_FIELD_QUESTIONS: [keyof TripPlanFormErrors, string][] = [
  ['destination', 'plan.questionDestination'],
  ['travelers', 'plan.questionTravelers'],
  ['budget', 'plan.questionBudget'],
  ['styles', 'plan.questionStyles'],
]

/** 아직 채워지지 않은 필수 필드 중 첫 번째에 대한 질문 키를 돌려준다. 순서(목적지→인원→예산→스타일)가 곧 되묻는 순서다. */
export function nextTripPlanQuestion(values: TripPlanFormValues): string | null {
  const errors = validateTripPlanForm(values)
  const next = REQUIRED_FIELD_QUESTIONS.find(([field]) => errors[field])
  return next ? next[1] : null
}

export function isTripPlanReady(values: TripPlanFormValues): boolean {
  return nextTripPlanQuestion(values) === null
}
