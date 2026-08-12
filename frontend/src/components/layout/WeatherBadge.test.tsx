// 로딩 중/실패 시엔 아무것도 안 그리는(자리표시자 없음) 조용한 실패 동작까지 포함해 검증한다 —
// 날씨는 부가 정보라 실패해도 레이아웃이 깨지지 않아야 하기 때문.
import { render, screen, waitFor } from '@testing-library/react'
import { WeatherBadge } from './WeatherBadge'
import type { TodayWeather } from '../../lib/weather'

function resolvedWeather(weather: TodayWeather) {
  return vi.fn().mockResolvedValue(weather)
}

describe('WeatherBadge', () => {
  it("renders today's weather icon and label once loaded", async () => {
    const fetchWeather = resolvedWeather({ condition: 'sunny', label: '맑음', icon: '☀️', temperature: 25 })
    render(<WeatherBadge fetchWeather={fetchWeather} />)

    expect(await screen.findByText('☀️')).toBeInTheDocument()
    expect(screen.getByText('맑음')).toBeInTheDocument()
  })

  it('renders a different icon for a rainy day', async () => {
    const fetchWeather = resolvedWeather({ condition: 'rainy', label: '비', icon: '🌧️', temperature: 18 })
    render(<WeatherBadge fetchWeather={fetchWeather} />)

    expect(await screen.findByLabelText(/오늘 날씨/)).toBeInTheDocument()
    expect(screen.getByText('🌧️')).toBeInTheDocument()
  })

  it('renders nothing before the weather has loaded', () => {
    const fetchWeather = vi.fn().mockReturnValue(new Promise(() => {}))
    render(<WeatherBadge fetchWeather={fetchWeather} />)

    expect(screen.queryByLabelText(/오늘 날씨/)).not.toBeInTheDocument()
  })

  it('renders nothing when the weather fetch fails', async () => {
    const fetchWeather = vi.fn().mockRejectedValue(new Error('network error'))
    render(<WeatherBadge fetchWeather={fetchWeather} />)

    await waitFor(() => expect(fetchWeather).toHaveBeenCalled())
    expect(screen.queryByLabelText(/오늘 날씨/)).not.toBeInTheDocument()
  })
})
