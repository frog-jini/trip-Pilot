// PlanChatPage(대화로 일정 만들기)의 두뇌. 정규식 기반 추출이 우선이고, 부족한 부분만 로컬 LLM이
// 보조한다(parseTripPlanMessageWithAi) — chatIntent.ts와 같은 "규칙 먼저, AI는 보너스" 철학이다.
//
// chatIntent.ts와 마찬가지로 ko/en/ja마다 표현 자체가 다르므로("2박 3일" vs "2 nights 3 days" vs
// "2泊3日") 언어별 패턴을 따로 둔다. language를 넘기지 않으면 기존 동작(한국어)과 동일하게 'ko'로
// 취급한다. 저장되는 값(duration/styles)은 언어와 무관하게 항상 한국어 canonical 문자열이다
// (tripPlan.ts 참고) — 언어별 패턴은 "인식"만 다르게 하고, 결과값은 그대로 재사용한다.
import { DURATION_OPTIONS, STYLE_OPTIONS, type Duration, type TravelStyle, type TripPlanFormValues } from './tripPlan'
import { validateTripPlanForm, type TripPlanFormErrors } from './tripPlanValidation'
import { findCatalogKey } from './destinationCatalog'
import type { Language } from './i18n/language'

interface DurationExtractor {
  pattern: RegExp
  // 캡처 그룹 순서가 언어마다 다르다 — "2 nights 3 days"는 (박,일) 순이지만 "3 days 2 nights"는
  // (일,박) 순이라, 어느 그룹이 몇 박/며칠인지 언어별로 명시해야 한다.
  order: 'nightsFirst' | 'daysFirst'
}

interface BudgetExtractor {
  pattern: RegExp
  // 캡처한 숫자를 "만원" 단위 문자열로 바꾸는 함수. 생략하면 캡처값을 그대로 쓴다 — 한국어/일본어처럼
  // "숫자+만원" 형태로 답해서 캡처 그룹 자체가 이미 만원 단위 숫자인 경우. 영어는 반대로 "1,000,000
  // KRW"처럼 총액으로 답하는 경우가 많아, 그 경우엔 총액을 10000으로 나눠 만원 단위로 바꿔준다.
  toManWon?: (raw: string) => string
}

interface TripPlanLanguageConfig {
  durationExtractors: DurationExtractor[]
  travelersPattern: RegExp
  budgetExtractors: BudgetExtractor[]
  // "각 50만원씩", "1인당 50만원"처럼 1인 기준 금액으로 답하는 경우를 가리키는 표현. 매칭되면
  // extractBudget()이 인원 수를 곱해서 총 예산으로 환산한다 — 질문(questionBudget)은 항상 총액을
  // 묻지만, 실제로는 1인 기준으로 답하는 사용자가 흔하기 때문이다.
  perPersonBudgetPattern: RegExp
  styleKeywordGroups: [string[], TravelStyle][]
}

const KO_CONFIG: TripPlanLanguageConfig = {
  durationExtractors: [{ pattern: /(\d)\s*박\s*(\d)\s*일/, order: 'nightsFirst' }],
  travelersPattern: /(\d+)\s*명/,
  budgetExtractors: [{ pattern: /(\d+)\s*만\s*원/ }],
  perPersonBudgetPattern: /각|1인당|인당|씩/,
  styleKeywordGroups: [
    [['관광'], '관광 중심'],
    [['맛집'], '맛집 중심'],
    [['쇼핑'], '쇼핑 중심'],
    [['힐링', '휴양'], '힐링 여행'],
    [['가족'], '가족 여행'],
    [['커플', '연인'], '커플 여행'],
    [['혼자', '나홀로'], '혼자 여행'],
  ],
}

const EN_CONFIG: TripPlanLanguageConfig = {
  durationExtractors: [
    { pattern: /(\d)\s*nights?[^\d]{0,10}(\d)\s*days?/i, order: 'nightsFirst' },
    { pattern: /(\d)\s*days?[^\d]{0,10}(\d)\s*nights?/i, order: 'daysFirst' },
  ],
  travelersPattern: /(\d+)\s*(?:people|persons?|travell?ers?)/i,
  budgetExtractors: [
    // "100 man won" 처럼 이미 만원 단위로 답하는 경우 — 캡처값을 그대로 쓴다.
    { pattern: /(\d+)\s*man\s*won/i },
    // 채팅 안내 문구(questionBudget/placeholder)가 실제로는 "1,000,000 KRW"처럼 총액으로 답하도록
    // 예시를 드는데, 정작 위 패턴은 이 형태를 인식하지 못해서 안내대로 답해도 인식되지 않는 버그가
    // 있었다. 콤마 섞인 총액(krw/won)을 인식해서 10000으로 나눈 만원 단위로 환산해준다.
    {
      pattern: /((?:\d{1,3}(?:,\d{3})+|\d+))\s*(?:krw|won)/i,
      toManWon: (raw) => String(Math.round(Number(raw.replace(/,/g, '')) / 10000)),
    },
  ],
  perPersonBudgetPattern: /\beach\b|\bper\s*(?:person|head)\b/i,
  styleKeywordGroups: [
    [['sightseeing', 'sight-seeing', 'tour'], '관광 중심'],
    [['food', 'foodie', 'restaurant', 'culinary'], '맛집 중심'],
    [['shopping'], '쇼핑 중심'],
    [['relax', 'healing', 'spa'], '힐링 여행'],
    [['family'], '가족 여행'],
    [['couple', 'romantic'], '커플 여행'],
    [['solo', 'alone'], '혼자 여행'],
  ],
}

const JA_CONFIG: TripPlanLanguageConfig = {
  durationExtractors: [{ pattern: /(\d)\s*泊\s*(\d)\s*日/, order: 'nightsFirst' }],
  travelersPattern: /(\d+)\s*(?:名|人)/,
  // 예산 질문(questionBudget)이 "100万ウォン"처럼 답하도록 안내하므로 ウォン(원)을 기본으로 인식하고,
  // 円(엔)으로 답하는 경우도 함께 받아준다 — 실제 저장되는 값은 통화와 무관하게 항상 "만원" 단위 숫자다.
  budgetExtractors: [{ pattern: /(\d+)\s*万\s*(?:ウォン|円)/ }],
  perPersonBudgetPattern: /一人当たり|一人あたり|それぞれ|各/,
  styleKeywordGroups: [
    [['観光'], '관광 중심'],
    [['グルメ', '食べ歩き'], '맛집 중심'],
    [['ショッピング', '買い物'], '쇼핑 중심'],
    [['癒し', 'リラックス', 'ヒーリング'], '힐링 여행'],
    [['家族'], '가족 여행'],
    [['カップル', '恋人'], '커플 여행'],
    [['一人旅', 'ひとり旅'], '혼자 여행'],
  ],
}

const CONFIG_BY_LANGUAGE: Record<Language, TripPlanLanguageConfig> = {
  ko: KO_CONFIG,
  en: EN_CONFIG,
  ja: JA_CONFIG,
}

function configFor(language: Language): TripPlanLanguageConfig {
  return CONFIG_BY_LANGUAGE[language] ?? KO_CONFIG
}

// 일본어 IME는 숫자를 반각(半角, ASCII 0-9)이 아니라 전각(全角, １２３...)으로 입력하는 경우가
// 흔한데, 정규식의 \d는 반각 숫자만 매칭한다. 그래서 매칭 전에 전각 숫자를 반각으로 정규화해둔다
// (언어 무관하게 적용해도 다른 언어 입력에는 전각 숫자가 나타나지 않으므로 부작용이 없다).
function normalizeFullWidthDigits(message: string): string {
  return message.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 영어처럼 공백으로 단어가 구분되는 언어의 키워드는 \b(단어 경계)로 감싸서 매칭해야
// "tourist" 안의 "tour"처럼 다른 단어에 우연히 포함된 부분 문자열을 스타일 키워드로
// 오인식하지 않는다. 한국어/일본어는 조사가 공백 없이 바로 붙어 \b가 성립하지 않으므로
// 라틴 문자로만 이뤄진 키워드에만 적용한다.
const ASCII_WORD_KEYWORD = /^[a-z0-9][a-z0-9\s'-]*$/i

function keywordMatches(lowerMessage: string, keyword: string): boolean {
  const lowerKeyword = keyword.toLowerCase()
  if (ASCII_WORD_KEYWORD.test(lowerKeyword)) {
    return new RegExp(`\\b${escapeRegExp(lowerKeyword)}\\b`).test(lowerMessage)
  }
  return lowerMessage.includes(lowerKeyword)
}

function extractDestination(message: string): string | null {
  return findCatalogKey(message)
}

function extractDuration(message: string, config: TripPlanLanguageConfig): Duration | null {
  for (const { pattern, order } of config.durationExtractors) {
    const match = message.match(pattern)
    if (!match) continue

    const [nights, days] = order === 'nightsFirst' ? [match[1], match[2]] : [match[2], match[1]]
    const candidate = `${nights}박 ${days}일`
    if ((DURATION_OPTIONS as readonly string[]).includes(candidate)) return candidate as Duration
  }
  return null
}

function extractTravelers(message: string, config: TripPlanLanguageConfig): string | null {
  const match = message.match(config.travelersPattern)
  return match ? match[1] : null
}

// questionBudget은 항상 "총 예산"을 묻지만, 실제로는 "각 50만원씩"처럼 1인 기준으로 답하는
// 경우가 흔하다. travelersCount가 있고 perPersonBudgetPattern에 걸리면 인원 수를 곱해 총액으로
// 환산한다 — travelersCount를 모르면(아직 인원을 안 물어봤다면) 곱할 수 없으니 그대로 둔다.
function extractBudget(message: string, config: TripPlanLanguageConfig, travelersCount: number | null): string | null {
  for (const { pattern, toManWon } of config.budgetExtractors) {
    const match = message.match(pattern)
    if (!match) continue

    const raw = match[1]
    const value = toManWon ? toManWon(raw) : raw

    if (travelersCount && travelersCount > 0 && config.perPersonBudgetPattern.test(message)) {
      return String(Math.round(Number(value) * travelersCount))
    }
    return value
  }
  return null
}

function extractStyles(message: string, config: TripPlanLanguageConfig): TravelStyle[] {
  const lowerMessage = message.toLowerCase()
  return config.styleKeywordGroups
    .filter(([keywords]) => keywords.some((keyword) => keywordMatches(lowerMessage, keyword)))
    .map(([, style]) => style)
}

// "몇 명이서 가시나요?"/"예산은 얼마로 생각하세요?" 같은 질문에 사용자가 "3명"/"100만원"이 아니라
// 그냥 "3"처럼 숫자만 답하는 경우가 실제로 흔하다. 정규식이 단위를 요구해서 이런 짧은 답을 놓치던
// 버그를 고치기 위한 보조 추출 — 숫자(와 선택적으로 몇 안 되는 흔한 단위)만 있는 메시지에서만
// 동작하므로, "2박 3일" 같은 다른 필드의 숫자까지 오인식하지는 않는다. 언어와 무관하게 숫자
// 자체는 아라비아 숫자로 쓰는 경우가 대부분이라 언어별 분기 없이 공용으로 둔다.
function extractLoneNumber(message: string): string | null {
  const match = message.trim().match(/^(\d+)\s*(?:명|인|분|people|persons?|人|名)?\s*$/i)
  return match ? match[1] : null
}

/** validateTripPlanForm() 기준으로, 지금 대화에서 다음에 채워야 할 필드가 뭔지 돌려준다(다 채워졌으면 null). */
function nextRequiredField(values: TripPlanFormValues): keyof TripPlanFormErrors | null {
  const errors = validateTripPlanForm(values)
  const next = REQUIRED_FIELD_QUESTIONS.find(([field]) => errors[field])
  return next ? next[0] : null
}

export function parseTripPlanMessage(
  message: string,
  current: TripPlanFormValues,
  language: Language = 'ko',
): TripPlanFormValues {
  const config = configFor(language)
  const normalizedMessage = normalizeFullWidthDigits(message)
  const destination = extractDestination(normalizedMessage)
  const duration = extractDuration(normalizedMessage, config)
  const travelers = extractTravelers(normalizedMessage, config)
  const effectiveTravelers = Number(travelers ?? current.travelers)
  const travelersCount = Number.isFinite(effectiveTravelers) && effectiveTravelers > 0 ? effectiveTravelers : null
  const budget = extractBudget(normalizedMessage, config, travelersCount)
  const newStyles = extractStyles(normalizedMessage, config)

  // 다른 필드가 이미 이 메시지에서 뽑혔다면(예: "2박 3일") 그 숫자를 인원/예산으로 오인식하지
  // 않도록, 정규식이 인원/예산을 못 찾았을 때만 그리고 방금 그 질문을 하고 있던 상황에서만
  // lone-number 보조 추출을 적용한다.
  const pendingField = nextRequiredField(current)
  const loneNumber = destination === null && duration === null ? extractLoneNumber(normalizedMessage) : null
  const fallbackTravelers = travelers === null && pendingField === 'travelers' ? loneNumber : null
  const fallbackBudget = budget === null && pendingField === 'budget' ? loneNumber : null

  return {
    ...current,
    destination: destination ?? current.destination,
    duration: duration ?? current.duration,
    travelers: travelers ?? fallbackTravelers ?? current.travelers,
    budget: budget ?? fallbackBudget ?? current.budget,
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
  language: Language = 'ko',
): Promise<TripPlanFormValues> {
  const ruleBased = parseTripPlanMessage(message, current, language)
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
  const field = nextRequiredField(values)
  return REQUIRED_FIELD_QUESTIONS.find(([f]) => f === field)?.[1] ?? null
}

export function isTripPlanReady(values: TripPlanFormValues): boolean {
  return nextTripPlanQuestion(values) === null
}
