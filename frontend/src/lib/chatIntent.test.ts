// chatIntent.ts의 정규식 기반 파서 3종(날씨/활동추가/활동삭제)을 검증한다. 이 파서들이 여기서
// 못 알아듣는 문장만 tripChatAction.ts의 로컬 LLM으로 넘어가므로, 어떤 표현까지 규칙만으로
// 커버되는지가 이 테스트 목록 자체로 드러난다.
import { parseAddActivityIntent, parseRemoveActivityIntent, parseWeatherIntent } from './chatIntent'

describe('parseWeatherIntent', () => {
  it('parses an ordinal day word with rain', () => {
    expect(parseWeatherIntent('둘째 날은 비가 올 것 같아')).toEqual({ day: 2, weather: 'rain' })
  })

  it('parses a numeric day with 일차 and snow', () => {
    expect(parseWeatherIntent('3일차에 눈 온대')).toEqual({ day: 3, weather: 'snow' })
  })

  it('parses "첫째 날" as day 1', () => {
    expect(parseWeatherIntent('첫째 날 비 온다는데')).toEqual({ day: 1, weather: 'rain' })
  })

  it('parses a plain number with 일', () => {
    expect(parseWeatherIntent('4일에 비 와요')).toEqual({ day: 4, weather: 'rain' })
  })

  it('returns null weather when no weather keyword is present', () => {
    expect(parseWeatherIntent('둘째 날 일정 알려줘')).toEqual({ day: 2, weather: null })
  })

  it('returns null day when no day reference is present', () => {
    expect(parseWeatherIntent('비가 올 것 같아')).toEqual({ day: null, weather: 'rain' })
  })

  it('returns nulls for an unrelated message', () => {
    expect(parseWeatherIntent('안녕하세요')).toEqual({ day: null, weather: null })
  })

  it('parses a typhoon/storm warning', () => {
    expect(parseWeatherIntent('둘째 날 태풍이 온대')).toEqual({ day: 2, weather: 'storm' })
  })

  it('parses fine dust', () => {
    expect(parseWeatherIntent('3일차에 미세먼지가 심하대')).toEqual({ day: 3, weather: 'dust' })
  })

  it('parses a heatwave', () => {
    expect(parseWeatherIntent('첫째 날 폭염이래')).toEqual({ day: 1, weather: 'heat' })
  })

  it('parses being hot in everyday wording', () => {
    expect(parseWeatherIntent('둘째 날 너무 더울 것 같아')).toEqual({ day: 2, weather: 'heat' })
  })

  it('parses a cold snap', () => {
    expect(parseWeatherIntent('넷째 날 한파래')).toEqual({ day: 4, weather: 'cold' })
  })

  it('parses clear/sunny weather', () => {
    expect(parseWeatherIntent('둘째 날은 날씨가 맑대')).toEqual({ day: 2, weather: 'clear' })
  })

  it('parses a request to switch a day back to outdoor activities', () => {
    expect(parseWeatherIntent('첫째 날 다시 실외로 해줘')).toEqual({ day: 1, weather: 'outdoor' })
  })

  it('parses "야외" as an outdoor request', () => {
    expect(parseWeatherIntent('셋째 날 야외로 바꿔줘')).toEqual({ day: 3, weather: 'outdoor' })
  })

  it('still recognizes the day when only an outdoor request follows, with no other weather word', () => {
    expect(parseWeatherIntent('둘째 날은 눈이 온다더니 실외로 해줘')).toEqual({ day: 2, weather: 'outdoor' })
  })
})

describe('parseAddActivityIntent', () => {
  it('parses a numeric day with 일날에는 and an activity to add', () => {
    expect(parseAddActivityIntent('2일날에는 디즈니를 추가해줘')).toEqual({ day: 2, activity: '디즈니' })
  })

  it('parses a numeric day with 일차에 and 넣어줘', () => {
    expect(parseAddActivityIntent('1일차에 스시집 넣어줘')).toEqual({ day: 1, activity: '스시집' })
  })

  it('parses an ordinal day word with 포함시켜줘', () => {
    expect(parseAddActivityIntent('둘째날에 디즈니랜드 포함시켜줘')).toEqual({ day: 2, activity: '디즈니랜드' })
  })

  it('parses "첫째 날" with a space before the activity', () => {
    expect(parseAddActivityIntent('첫째 날에 스카이트리 추가해줘')).toEqual({ day: 1, activity: '스카이트리' })
  })

  it('returns null activity when there is no add keyword', () => {
    expect(parseAddActivityIntent('2일차는 비가 올 것 같아')).toEqual({ day: null, activity: null })
  })

  it('returns nulls for an unrelated message', () => {
    expect(parseAddActivityIntent('안녕하세요')).toEqual({ day: null, activity: null })
  })

  it('returns null day when no day reference is present', () => {
    expect(parseAddActivityIntent('디즈니랜드 추가해줘')).toEqual({ day: null, activity: '디즈니랜드' })
  })
})

describe('parseRemoveActivityIntent', () => {
  it('parses a numeric day with 일차에 and 삭제해줘', () => {
    expect(parseRemoveActivityIntent('1일차에 디즈니랜드 삭제해줘')).toEqual({ day: 1, activity: '디즈니랜드' })
  })

  it('parses "빼줘" as a removal keyword', () => {
    expect(parseRemoveActivityIntent('2일차에 스시집 빼줘')).toEqual({ day: 2, activity: '스시집' })
  })

  it('parses "제거" as a removal keyword', () => {
    expect(parseRemoveActivityIntent('둘째날에 디즈니랜드 제거해줘')).toEqual({ day: 2, activity: '디즈니랜드' })
  })

  it('parses "없애" as a removal keyword', () => {
    expect(parseRemoveActivityIntent('첫째 날에 스카이트리 없애줘')).toEqual({ day: 1, activity: '스카이트리' })
  })

  it('returns null activity when there is no removal keyword', () => {
    expect(parseRemoveActivityIntent('1일차에 디즈니랜드 추가해줘')).toEqual({ day: null, activity: null })
  })

  it('returns nulls for an unrelated message', () => {
    expect(parseRemoveActivityIntent('안녕하세요')).toEqual({ day: null, activity: null })
  })

  it('returns null day when no day reference is present', () => {
    expect(parseRemoveActivityIntent('디즈니랜드 삭제해줘')).toEqual({ day: null, activity: '디즈니랜드' })
  })
})
