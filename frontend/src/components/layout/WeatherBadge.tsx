import { useEffect, useState } from 'react'
import { fetchCurrentWeather, type TodayWeather, type WeatherCondition } from '../../lib/weather'
import { useLanguage } from '../../context/languageContextValue'

interface WeatherBadgeProps {
  fetchWeather?: () => Promise<TodayWeather>
}

const WEATHER_CONDITION_KEYS: Record<WeatherCondition, string> = {
  sunny: 'common.weatherSunny',
  cloudy: 'common.weatherCloudy',
  rainy: 'common.weatherRainy',
  snowy: 'common.weatherSnowy',
}

// 헤더에 보여주는 서울 좌표 기준 현재 날씨 배지. 조회 실패 시(오프라인 등) 그냥 아무것도
// 렌더링하지 않는다 — 날씨는 부가 정보라 에러 메시지로 헤더를 어지럽힐 필요가 없다.
export function WeatherBadge({ fetchWeather = fetchCurrentWeather }: WeatherBadgeProps) {
  const { t } = useLanguage()
  const [weather, setWeather] = useState<TodayWeather | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchWeather()
      .then((result) => {
        if (!cancelled) setWeather(result)
      })
      .catch(() => {
        if (!cancelled) setWeather(null)
      })

    return () => {
      cancelled = true
    }
  }, [fetchWeather])

  if (!weather) return null

  const label = t(WEATHER_CONDITION_KEYS[weather.condition])

  return (
    <span
      aria-label={t('common.weatherAriaLabel', { label })}
      className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300"
    >
      <span aria-hidden="true">{weather.icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}
