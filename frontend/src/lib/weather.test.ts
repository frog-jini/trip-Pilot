// Open-Meteo 날씨 코드 매핑, 예보/현재 날씨 조회, 요약 텍스트 포맷팅을 검증한다.
import { fetchCurrentWeather, fetchDailyForecast, formatForecastSummary, mapWeatherCodeToCondition } from './weather'
import { translate } from './i18n/translations'

const t = (key: string, params?: Record<string, string | number>) => translate('ko', key, params)
const tEn = (key: string, params?: Record<string, string | number>) => translate('en', key, params)

describe('mapWeatherCodeToCondition', () => {
  it('maps code 0 to sunny', () => {
    expect(mapWeatherCodeToCondition(0)).toBe('sunny')
  })

  it('maps cloudy/fog codes to cloudy', () => {
    expect(mapWeatherCodeToCondition(2)).toBe('cloudy')
    expect(mapWeatherCodeToCondition(45)).toBe('cloudy')
  })

  it('maps rain/drizzle/thunderstorm codes to rainy', () => {
    expect(mapWeatherCodeToCondition(61)).toBe('rainy')
    expect(mapWeatherCodeToCondition(95)).toBe('rainy')
  })

  it('maps snow codes to snowy', () => {
    expect(mapWeatherCodeToCondition(71)).toBe('snowy')
    expect(mapWeatherCodeToCondition(85)).toBe('snowy')
  })
})

describe('fetchCurrentWeather', () => {
  function fakeFetch(weathercode: number, temperature = 22) {
    return vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ current_weather: { weathercode, temperature } }),
    })
  }

  it('requests the Open-Meteo current weather endpoint', async () => {
    const fetchImpl = fakeFetch(0)
    await fetchCurrentWeather({ latitude: 37.5665, longitude: 126.978 }, fetchImpl)

    const [url] = fetchImpl.mock.calls[0]
    expect(url).toContain('api.open-meteo.com')
    expect(url).toContain('latitude=37.5665')
    expect(url).toContain('longitude=126.978')
  })

  it('converts a clear weather code into a sunny result with the label, icon, and temperature', async () => {
    const weather = await fetchCurrentWeather({ latitude: 37.5665, longitude: 126.978 }, fakeFetch(0, 28))

    expect(weather).toEqual({ condition: 'sunny', label: '맑음', icon: '☀️', temperature: 28 })
  })

  it('converts a rain weather code into a rainy result', async () => {
    const weather = await fetchCurrentWeather({ latitude: 37.5665, longitude: 126.978 }, fakeFetch(61))
    expect(weather.condition).toBe('rainy')
    expect(weather.label).toBe('비')
  })

  it('throws when the response is not ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) })

    await expect(
      fetchCurrentWeather({ latitude: 37.5665, longitude: 126.978 }, fetchImpl),
    ).rejects.toThrow()
  })
})

describe('fetchDailyForecast', () => {
  function fakeFetch() {
    return vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          daily: {
            time: ['2026-07-25', '2026-07-26', '2026-07-27'],
            weathercode: [0, 61, 71],
            temperature_2m_max: [30, 26, 3],
            temperature_2m_min: [22, 20, -2],
            precipitation_sum: [0, 12.4, 5],
          },
        }),
    })
  }

  it('requests the Open-Meteo daily forecast endpoint for the given date range', async () => {
    const fetchImpl = fakeFetch()
    await fetchDailyForecast('2026-07-25', 3, { latitude: 37.5665, longitude: 126.978 }, fetchImpl)

    const [url] = fetchImpl.mock.calls[0]
    expect(url).toContain('api.open-meteo.com')
    expect(url).toContain('start_date=2026-07-25')
    expect(url).toContain('end_date=2026-07-27')
  })

  it('returns one forecast entry per day with date, condition, temperatures, and precipitation', async () => {
    const forecasts = await fetchDailyForecast(
      '2026-07-25',
      3,
      { latitude: 37.5665, longitude: 126.978 },
      fakeFetch(),
    )

    expect(forecasts).toEqual([
      { date: '2026-07-25', condition: 'sunny', maxTemperature: 30, minTemperature: 22, precipitation: 0 },
      { date: '2026-07-26', condition: 'rainy', maxTemperature: 26, minTemperature: 20, precipitation: 12.4 },
      { date: '2026-07-27', condition: 'snowy', maxTemperature: 3, minTemperature: -2, precipitation: 5 },
    ])
  })

  it('throws when the response is not ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) })

    await expect(
      fetchDailyForecast('2026-07-25', 3, { latitude: 37.5665, longitude: 126.978 }, fetchImpl),
    ).rejects.toThrow()
  })

  describe('when the trip extends beyond the forecast horizon', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-07-25T00:00:00'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('clamps the requested end date to the forecast horizon instead of letting the whole call fail', async () => {
      const fetchImpl = fakeFetch()
      await fetchDailyForecast('2026-08-01', 20, { latitude: 37.5665, longitude: 126.978 }, fetchImpl)

      const [url] = fetchImpl.mock.calls[0]
      expect(url).toContain('start_date=2026-08-01')
      expect(url).toContain('end_date=2026-08-09')
    })

    it('returns an empty list without calling fetch when the entire range is beyond the horizon', async () => {
      const fetchImpl = vi.fn()
      const forecasts = await fetchDailyForecast(
        '2026-09-01',
        3,
        { latitude: 37.5665, longitude: 126.978 },
        fetchImpl,
      )

      expect(forecasts).toEqual([])
      expect(fetchImpl).not.toHaveBeenCalled()
    })

    it('leaves a normal near-term request untouched', async () => {
      const fetchImpl = fakeFetch()
      await fetchDailyForecast('2026-07-25', 3, { latitude: 37.5665, longitude: 126.978 }, fetchImpl)

      const [url] = fetchImpl.mock.calls[0]
      expect(url).toContain('end_date=2026-07-27')
    })
  })
})

describe('formatForecastSummary', () => {
  it('formats condition icon, high/low temperatures, and precipitation', () => {
    const summary = formatForecastSummary(
      {
        date: '2026-07-25',
        condition: 'rainy',
        maxTemperature: 26,
        minTemperature: 20,
        precipitation: 12.4,
      },
      t,
    )

    expect(summary).toBe('🌧️ 최고 26° · 최저 20° · 강수 12.4mm')
  })

  it('omits precipitation when there is none', () => {
    const summary = formatForecastSummary(
      {
        date: '2026-07-25',
        condition: 'sunny',
        maxTemperature: 30,
        minTemperature: 22,
        precipitation: 0,
      },
      t,
    )

    expect(summary).toBe('☀️ 최고 30° · 최저 22°')
  })

  it('formats using the given language', () => {
    const summary = formatForecastSummary(
      {
        date: '2026-07-25',
        condition: 'rainy',
        maxTemperature: 26,
        minTemperature: 20,
        precipitation: 12.4,
      },
      tEn,
    )

    expect(summary).toBe('🌧️ High 26° · Low 20° · Precip. 12.4mm')
  })
})
