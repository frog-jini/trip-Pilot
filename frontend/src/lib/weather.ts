// Open-Meteo 무료 API(가입/키 불필요) 연동. 헤더의 실시간 배지(fetchCurrentWeather)와
// 일정 상세의 일자별 예보(fetchDailyForecast) 양쪽에서 쓴다. 서버를 거치지 않고 브라우저에서
// 직접 호출한다.
import { addDaysIso, todayIso } from './dateUtils'

export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'snowy'

export interface TodayWeather {
  condition: WeatherCondition
  label: string
  icon: string
  temperature: number
}

const CONDITION_INFO: Record<WeatherCondition, { label: string; icon: string }> = {
  sunny: { label: '맑음', icon: '☀️' },
  cloudy: { label: '흐림', icon: '☁️' },
  rainy: { label: '비', icon: '🌧️' },
  snowy: { label: '눈', icon: '❄️' },
}

const CLOUDY_CODES = new Set([1, 2, 3, 45, 48])
const RAINY_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99])
const SNOWY_CODES = new Set([71, 73, 75, 77, 85, 86])

// Open-Meteo는 WMO 표준 날씨 코드(숫자)를 돌려준다. 이 프로젝트는 아이콘 4종류만 쓰면
// 충분해서, 세분화된 코드들을 sunny/cloudy/rainy/snowy 4개로 뭉뚱그린다.
export function mapWeatherCodeToCondition(code: number): WeatherCondition {
  if (code === 0) return 'sunny'
  if (CLOUDY_CODES.has(code)) return 'cloudy'
  if (RAINY_CODES.has(code)) return 'rainy'
  if (SNOWY_CODES.has(code)) return 'snowy'
  return 'cloudy'
}

export interface Coordinates {
  latitude: number
  longitude: number
}

export const SEOUL_COORDINATES: Coordinates = { latitude: 37.5665, longitude: 126.978 }

// 헤더의 WeatherBadge가 쓰는 "지금 날씨" — 좌표를 안 넘기면 서울 기준(SEOUL_COORDINATES)이다.
export async function fetchCurrentWeather(
  coordinates: Coordinates = SEOUL_COORDINATES,
  fetchImpl: typeof fetch = fetch,
): Promise<TodayWeather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&current_weather=true`
  const response = await fetchImpl(url)

  if (!response.ok) {
    throw new Error('날씨 정보를 불러오지 못했어요.')
  }

  const data = await response.json()
  const condition = mapWeatherCodeToCondition(data.current_weather.weathercode)
  const { label, icon } = CONDITION_INFO[condition]

  return { condition, label, icon, temperature: data.current_weather.temperature }
}

export interface DailyForecast {
  date: string
  condition: WeatherCondition
  maxTemperature: number
  minTemperature: number
  precipitation: number
}

// Open-Meteo's free forecast endpoint only covers ~16 days from today; requesting
// a date beyond that fails the entire call instead of just omitting those days.
const MAX_FORECAST_DAYS_AHEAD = 15

export async function fetchDailyForecast(
  startDate: string,
  days: number,
  coordinates: Coordinates = SEOUL_COORDINATES,
  fetchImpl: typeof fetch = fetch,
): Promise<DailyForecast[]> {
  const requestedEndDate = addDaysIso(startDate, days - 1)
  const latestAvailableDate = addDaysIso(todayIso(), MAX_FORECAST_DAYS_AHEAD)
  const endDate = requestedEndDate < latestAvailableDate ? requestedEndDate : latestAvailableDate

  if (endDate < startDate) {
    return []
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&start_date=${startDate}&end_date=${endDate}`
  const response = await fetchImpl(url)

  if (!response.ok) {
    throw new Error('일자별 날씨 정보를 불러오지 못했어요.')
  }

  const data = await response.json()
  const { time, weathercode, temperature_2m_max, temperature_2m_min, precipitation_sum } = data.daily

  return time.map((date: string, index: number) => ({
    date,
    condition: mapWeatherCodeToCondition(weathercode[index]),
    maxTemperature: temperature_2m_max[index],
    minTemperature: temperature_2m_min[index],
    precipitation: precipitation_sum[index],
  }))
}

// t는 i18n의 translate(language, key, params)를 그대로 넘겨받는다 — 이 파일은 어떤 언어를
// 쓰는지 모르는 순수 로직이라, 문구 자체는 호출부(컴포넌트)의 useLanguage().t를 그대로 전달받아 쓴다.
export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export function formatForecastSummary(forecast: DailyForecast, t: TranslateFn): string {
  const { icon } = CONDITION_INFO[forecast.condition]
  const base = `${icon} ${t('common.forecastHigh')} ${forecast.maxTemperature}° · ${t('common.forecastLow')} ${forecast.minTemperature}°`
  return forecast.precipitation > 0
    ? `${base} · ${t('common.forecastPrecipitation')} ${forecast.precipitation}mm`
    : base
}
