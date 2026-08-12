// 일정 상세 채팅에서 "n일차는 비가 올 것 같아", "2일차에 디즈니랜드 추가해줘" 같은 흔한 패턴을
// 정규식으로 즉시 알아듣는 빠른 경로다. 여기서 못 알아들은 문장만 로컬 LLM(tripChatAction.ts)으로
// 넘어간다 — 정규식이 100% 예측 가능하고 비용도 지연도 없기 때문에 항상 먼저 시도한다.
export type WeatherKeyword = 'rain' | 'snow' | 'storm' | 'dust' | 'heat' | 'cold' | 'clear' | 'outdoor'

export interface WeatherIntent {
  day: number | null
  weather: WeatherKeyword | null
}

// "첫째/둘째/..." 같은 서수 표현으로 일차를 말하는 경우를 숫자로 매핑한다("N일차"는 정규식으로 바로 처리).
const ORDINAL_DAY_WORDS: [string, number][] = [
  ['첫째', 1],
  ['둘째', 2],
  ['셋째', 3],
  ['넷째', 4],
  ['다섯째', 5],
  ['여섯째', 6],
]

/** 메시지에서 "3일차", "3일", "둘째 날" 같은 일차 표현을 찾아 숫자로 반환한다. 없으면 null. */
function parseDay(message: string): number | null {
  const numeric = message.match(/(\d+)\s*일[차째]?/)
  if (numeric) return Number(numeric[1])

  for (const [word, day] of ORDINAL_DAY_WORDS) {
    if (message.includes(word)) return day
  }

  return null
}

// 여러 표현이 같은 날씨로 이어지도록 동의어를 묶어둔다(예: "더워/더울/더움" 모두 heat).
const WEATHER_KEYWORD_GROUPS: [string[], WeatherKeyword][] = [
  [['실외', '야외'], 'outdoor'],
  [['태풍', '폭풍'], 'storm'],
  [['미세먼지', '황사'], 'dust'],
  [['폭염', '무더위', '더워', '더울', '더움'], 'heat'],
  [['한파', '영하', '추워', '추울'], 'cold'],
  [['맑', '화창'], 'clear'],
  [['눈'], 'snow'],
  [['비'], 'rain'],
]

function parseWeatherKeyword(message: string): WeatherKeyword | null {
  for (const [keywords, weather] of WEATHER_KEYWORD_GROUPS) {
    if (keywords.some((keyword) => message.includes(keyword))) return weather
  }
  return null
}

/** 일차 + 날씨 키워드를 함께 뽑아낸다. 하나만 있어도 그 값만 채워서 돌려준다(둘 다 있어야 실행 가능). */
export function parseWeatherIntent(message: string): WeatherIntent {
  return {
    day: parseDay(message),
    weather: parseWeatherKeyword(message),
  }
}

export interface AddActivityIntent {
  day: number | null
  activity: string | null
}

// "2일날에는", "1일차에", "둘째날에" 처럼 일차를 가리키는 부분만 걷어내기 위한 패턴들.
const NUMERIC_DAY_PHRASE = /\d+\s*일[차째]?\s*(날)?\s*(에는|엔|에)?/
const ORDINAL_DAY_PHRASE = /(첫째|둘째|셋째|넷째|다섯째|여섯째)\s*(날)?\s*(에는|엔|에)?/

const ADD_KEYWORD = /추가|넣어|포함/
const REMOVE_KEYWORD = /삭제|빼줘|빼주|제거|없애/

/**
 * "n일차에 OO 추가해줘" / "n일차에 OO 삭제해줘" 처럼 "일차 + 활동명 + 동작 키워드" 형태의
 * 문장에서 일차와 활동명을 뽑아내는 공통 로직. keyword가 없는 문장이면 애초에 이 의도가 아니라고
 * 보고 둘 다 null을 돌려준다.
 */
function parseDayScopedActivity(message: string, keyword: RegExp): AddActivityIntent {
  if (!keyword.test(message)) {
    return { day: null, activity: null }
  }

  const day = parseDay(message)

  // 일차를 가리키는 부분을 지우고, 동작 키워드 뒤는 버린 다음, 남은 조사(을/를)만 떼어내면
  // 그 사이에 남는 텍스트가 활동명이다 — 별도의 활동 카탈로그 없이도 사용자가 부른 이름 그대로 쓴다.
  const withoutDayPhrase = message.replace(NUMERIC_DAY_PHRASE, '').replace(ORDINAL_DAY_PHRASE, '')
  const keywordMatch = withoutDayPhrase.match(keyword)
  const beforeKeyword = keywordMatch ? withoutDayPhrase.slice(0, keywordMatch.index) : withoutDayPhrase
  const activity = beforeKeyword.trim().replace(/(을|를)$/, '').trim()

  return { day, activity: activity || null }
}

/** "n일차에 OO 추가해줘" 같은 문장에서 일차와 넣고 싶은 활동명을 그대로 뽑아낸다. */
export function parseAddActivityIntent(message: string): AddActivityIntent {
  return parseDayScopedActivity(message, ADD_KEYWORD)
}

/** "n일차에 OO 삭제해줘" 같은 문장에서 일차와 지우고 싶은 활동명을 그대로 뽑아낸다. */
export function parseRemoveActivityIntent(message: string): AddActivityIntent {
  return parseDayScopedActivity(message, REMOVE_KEYWORD)
}
