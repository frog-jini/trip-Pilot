// 일정 상세 채팅에서 "n일차는 비가 올 것 같아", "2일차에 디즈니랜드 추가해줘" 같은 흔한 패턴을
// 정규식으로 즉시 알아듣는 빠른 경로다. 여기서 못 알아들은 문장만 로컬 LLM(tripChatAction.ts)으로
// 넘어간다 — 정규식이 100% 예측 가능하고 비용도 지연도 없기 때문에 항상 먼저 시도한다.
//
// UI 언어(ko/en/ja)마다 "일차"/"day"/"日目" 같은 표현 자체가 다른 문자를 쓰기 때문에(예: 한글
// "일"과 한자 "日"은 서로 다른 유니코드 문자), 키워드/정규식을 언어별로 따로 둔다. language를
// 넘기지 않으면 기존 동작(한국어)과 동일하게 'ko'로 취급한다.
import type { Language } from './i18n/language'

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

// 일본어 IME는 숫자를 반각(半角, ASCII 0-9)이 아니라 전각(全角, １２３...)으로 입력하는 경우가
// 흔한데, 정규식의 \d는 반각 숫자만 매칭한다. 그래서 매칭 전에 전각 숫자를 반각으로 정규화해둔다
// (언어 무관하게 적용해도 다른 언어 입력에는 전각 숫자가 나타나지 않으므로 부작용이 없다).
function normalizeFullWidthDigits(message: string): string {
  return message.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
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
    if (keywords.some((keyword) => lowerMessage.includes(keyword.toLowerCase()))) return weather
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
