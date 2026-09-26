// 일정 상세 채팅에서 "n일차는 비가 올 것 같아", "2일차에 디즈니랜드 추가해줘" 같은 흔한 패턴을
// 정규식으로 즉시 알아듣는 빠른 경로다. 여기서 못 알아들은 문장만 로컬 LLM(tripChatAction.ts)으로
// 넘어간다 — 정규식이 100% 예측 가능하고 비용도 지연도 없기 때문에 항상 먼저 시도한다.
//
// UI 언어(ko/en/ja)마다 "일차"/"day"/"日目" 같은 표현 자체가 다른 문자를 쓰기 때문에(예: 한글
// "일"과 한자 "日"은 서로 다른 유니코드 문자), 키워드/정규식을 언어별로 따로 둔다. language를
// 넘기지 않으면 기존 동작(한국어)과 동일하게 'ko'로 취급한다.
import type { Language } from './i18n/language'
import { keywordMatches, normalizeFullWidthDigits } from './chatTextMatch'

export type WeatherKeyword = 'rain' | 'snow' | 'storm' | 'dust' | 'heat' | 'cold' | 'clear' | 'outdoor'

export interface WeatherIntent {
  day: number | null
  weather: WeatherKeyword | null
}

interface LanguageIntentConfig {
  // "첫째/둘째/..." 같은 서수 표현으로 일차를 말하는 경우를 숫자로 매핑한다(숫자+단위 표현은 numericDayPattern으로 바로 처리).
  ordinalDayWords: [string, number][]
  // 메시지에서 숫자로 된 일차 표현("3일차", "day 3", "3日目")을 찾는 정규식. 캡처 그룹 1이 일차 숫자.
  numericDayPattern: RegExp
  // "2일날에는", "day 2", "2日目に" 처럼 일차를 가리키는 부분만 걷어내기 위한 패턴.
  numericDayPhrase: RegExp
  ordinalDayPhrase: RegExp
  weatherKeywordGroups: [string[], WeatherKeyword][]
  addKeyword: RegExp
  removeKeyword: RegExp
  // "추천해줘", "뭐가 있어" 같이 이름을 콕 집지 않고 제안을 구하는 요청을 감지하는 패턴.
  recommendKeyword: RegExp
  // 활동명 앞뒤에 붙는 조사/전치사를 떼어내기 위한 패턴(없으면 생략).
  trailingParticle?: RegExp
  // 한국어/일본어는 "활동명 + 추가해줘"(활동명이 키워드 앞), 영어는 "add 활동명"(활동명이 키워드
  // 뒤) 순서라서 활동명을 키워드의 어느 쪽에서 잘라낼지 언어별로 다르다.
  activityPosition: 'before' | 'after'
}

const KO_CONFIG: LanguageIntentConfig = {
  ordinalDayWords: [
    ['첫째', 1],
    ['둘째', 2],
    ['셋째', 3],
    ['넷째', 4],
    ['다섯째', 5],
    ['여섯째', 6],
  ],
  numericDayPattern: /(\d+)\s*일[차째]?/,
  numericDayPhrase: /\d+\s*일[차째]?\s*(날)?\s*(에는|엔|에)?/,
  ordinalDayPhrase: /(첫째|둘째|셋째|넷째|다섯째|여섯째)\s*(날)?\s*(에는|엔|에)?/,
  // 여러 표현이 같은 날씨로 이어지도록 동의어를 묶어둔다(예: "더워/더울/더움" 모두 heat).
  weatherKeywordGroups: [
    [['실외', '야외'], 'outdoor'],
    [['태풍', '폭풍'], 'storm'],
    [['미세먼지', '황사'], 'dust'],
    [['폭염', '무더위', '더워', '더울', '더움'], 'heat'],
    [['한파', '영하', '추워', '추울'], 'cold'],
    [['맑', '화창'], 'clear'],
    [['눈'], 'snow'],
    [['비'], 'rain'],
  ],
  addKeyword: /추가|넣어|포함/,
  removeKeyword: /삭제|빼줘|빼주|제거|없애/,
  // "추천해줘"/"추천해줄래" 같은 "추천" 계열과, 아무것도 지목하지 않고 묻는 "뭐가 있어"/"뭐 있어"를 함께 잡는다.
  recommendKeyword: /추천|뭐\s*(가\s*)?있/,
  trailingParticle: /(을|를)$/,
  activityPosition: 'before',
}

const JA_CONFIG: LanguageIntentConfig = {
  ordinalDayWords: [
    ['初日', 1],
    ['二日目', 2],
    ['三日目', 3],
    ['四日目', 4],
    ['五日目', 5],
    ['六日目', 6],
  ],
  numericDayPattern: /(\d+)\s*日目?/,
  numericDayPhrase: /\d+\s*日目?\s*(には|に)?/,
  ordinalDayPhrase: /(初日|二日目|三日目|四日目|五日目|六日目)\s*(には|に)?/,
  weatherKeywordGroups: [
    [['屋外', '野外'], 'outdoor'],
    [['台風', '暴風'], 'storm'],
    [['黄砂', '花粉'], 'dust'],
    [['猛暑', '酷暑', '暑い'], 'heat'],
    [['寒波', '寒い'], 'cold'],
    [['晴れ', '快晴'], 'clear'],
    [['雪'], 'snow'],
    [['雨'], 'rain'],
  ],
  addKeyword: /追加|入れて|含めて/,
  removeKeyword: /削除|消して|抜いて|外して/,
  recommendKeyword: /おすすめ|提案して/,
  trailingParticle: /(を|は|が)$/,
  activityPosition: 'before',
}

const EN_CONFIG: LanguageIntentConfig = {
  ordinalDayWords: [
    ['first day', 1],
    ['second day', 2],
    ['third day', 3],
    ['fourth day', 4],
    ['fifth day', 5],
    ['sixth day', 6],
  ],
  numericDayPattern: /day\s*(\d+)|(\d+)(?:st|nd|rd|th)?\s*day/i,
  numericDayPhrase: /\bon\s+day\s*\d+\b|\bday\s*\d+\b|\b\d+(?:st|nd|rd|th)?\s*day\b/gi,
  ordinalDayPhrase: /\b(?:on\s+the\s+)?(first|second|third|fourth|fifth|sixth)\s*day\b/gi,
  weatherKeywordGroups: [
    [['outdoor', 'outside'], 'outdoor'],
    [['typhoon', 'storm'], 'storm'],
    [['fine dust', 'dust'], 'dust'],
    [['heatwave', 'hot'], 'heat'],
    [['cold snap', 'freezing', 'cold'], 'cold'],
    [['clear', 'sunny'], 'clear'],
    [['snow'], 'snow'],
    [['rain'], 'rain'],
  ],
  addKeyword: /\badd\b|\binclude\b/i,
  removeKeyword: /\bremove\b|\bdelete\b|\btake out\b/i,
  recommendKeyword: /\brecommend\b|\bsuggest\b|\bwhat do you have\b/i,
  activityPosition: 'after',
}

const CONFIG_BY_LANGUAGE: Record<Language, LanguageIntentConfig> = {
  ko: KO_CONFIG,
  ja: JA_CONFIG,
  en: EN_CONFIG,
}

function configFor(language: Language): LanguageIntentConfig {
  return CONFIG_BY_LANGUAGE[language] ?? KO_CONFIG
}

/** 메시지에서 "3일차", "3일", "둘째 날" 같은 일차 표현을 찾아 숫자로 반환한다. 없으면 null. */
function parseDay(message: string, config: LanguageIntentConfig): number | null {
  const numeric = message.match(config.numericDayPattern)
  if (numeric) {
    const captured = numeric[1] ?? numeric[2]
    if (captured) return Number(captured)
  }

  const lowerMessage = message.toLowerCase()
  for (const [word, day] of config.ordinalDayWords) {
    if (lowerMessage.includes(word.toLowerCase())) return day
  }

  return null
}

function parseWeatherKeyword(message: string, config: LanguageIntentConfig): WeatherKeyword | null {
  const lowerMessage = message.toLowerCase()
  for (const [keywords, weather] of config.weatherKeywordGroups) {
    if (keywords.some((keyword) => keywordMatches(lowerMessage, keyword))) return weather
  }
  return null
}

/** 일차 + 날씨 키워드를 함께 뽑아낸다. 하나만 있어도 그 값만 채워서 돌려준다(둘 다 있어야 실행 가능). */
export function parseWeatherIntent(message: string, language: Language = 'ko'): WeatherIntent {
  const config = configFor(language)
  const normalizedMessage = normalizeFullWidthDigits(message)
  return {
    day: parseDay(normalizedMessage, config),
    weather: parseWeatherKeyword(normalizedMessage, config),
  }
}

// parseDay와 달리 parseWeatherKeyword는 실제 날씨 단어가 있어야만 값을 채워준다(게이트 있음).
// 그래서 "이 메시지가 날씨 얘기였는지"를 판단할 땐 WeatherIntent.day가 아니라 이 함수를 써야
// 한다 — day는 "3일차"처럼 다른 의도(추가/삭제)의 답변에서도 얼마든지 등장하기 때문에, day가
// 있다는 사실만으로 날씨 의도라고 단정하면 안 된다(TripDetailPage의 신고된 회귀 원인).
export function hasWeatherKeyword(message: string, language: Language = 'ko'): boolean {
  const config = configFor(language)
  return parseWeatherKeyword(normalizeFullWidthDigits(message), config) !== null
}

export interface AddActivityIntent {
  day: number | null
  activity: string | null
}

/**
 * "n일차에 OO 추가해줘" / "n일차에 OO 삭제해줘" 처럼 "일차 + 활동명 + 동작 키워드" 형태의
 * 문장에서 일차와 활동명을 뽑아내는 공통 로직. keyword가 없는 문장이면 애초에 이 의도가 아니라고
 * 보고 둘 다 null을 돌려준다.
 */
function parseDayScopedActivity(message: string, keyword: RegExp, config: LanguageIntentConfig): AddActivityIntent {
  if (!keyword.test(message)) {
    return { day: null, activity: null }
  }

  const day = parseDay(message, config)

  // 일차를 가리키는 부분을 지우고, 동작 키워드 뒤는 버린 다음, 남은 조사(을/를 등)만 떼어내면
  // 그 사이에 남는 텍스트가 활동명이다 — 별도의 활동 카탈로그 없이도 사용자가 부른 이름 그대로 쓴다.
  const withoutDayPhrase = message
    .replace(config.numericDayPhrase, '')
    .replace(config.ordinalDayPhrase, '')
  const keywordMatch = withoutDayPhrase.match(keyword)
  let rawActivity: string
  if (keywordMatch) {
    rawActivity =
      config.activityPosition === 'after'
        ? withoutDayPhrase.slice(keywordMatch.index! + keywordMatch[0].length)
        : withoutDayPhrase.slice(0, keywordMatch.index)
  } else {
    rawActivity = withoutDayPhrase
  }
  const trimmed = rawActivity.trim()
  const activity = (config.trailingParticle ? trimmed.replace(config.trailingParticle, '') : trimmed).trim()

  return { day, activity: activity || null }
}

/** "n일차에 OO 추가해줘" 같은 문장에서 일차와 넣고 싶은 활동명을 그대로 뽑아낸다. */
export function parseAddActivityIntent(message: string, language: Language = 'ko'): AddActivityIntent {
  const config = configFor(language)
  return parseDayScopedActivity(normalizeFullWidthDigits(message), config.addKeyword, config)
}

/** "n일차에 OO 삭제해줘" 같은 문장에서 일차와 지우고 싶은 활동명을 그대로 뽑아낸다. */
export function parseRemoveActivityIntent(message: string, language: Language = 'ko'): AddActivityIntent {
  const config = configFor(language)
  return parseDayScopedActivity(normalizeFullWidthDigits(message), config.removeKeyword, config)
}

export interface RecommendIntent {
  day: number | null
}

/**
 * "추천해줘", "뭐가 있어", "2일차에 뭐 넣을지 추천해줘" 같이 이름을 콕 집지 않고 제안을 구하는
 * 요청인지 판단한다. add/remove와 달리 사용자가 지목한 대상이 애초에 없는 요청이라 activity
 * 필드는 두지 않는다. 일차는 있으면 그 날 위주로, 없으면 전체 일정에서 골라도 되는 선택 정보라
 * add/remove/weather처럼 "완성될 때까지 기억"할 필요가 없다 — 그래서 매치되지 않으면 아예 null을
 * 돌려줘서(day:null인 객체가 아니라) 호출부가 "이 의도가 아니었다"를 한 번에 구분할 수 있게 한다.
 */
export function parseRecommendIntent(message: string, language: Language = 'ko'): RecommendIntent | null {
  const config = configFor(language)
  const normalizedMessage = normalizeFullWidthDigits(message)
  if (!config.recommendKeyword.test(normalizedMessage)) return null
  return { day: parseDay(normalizedMessage, config) }
}
