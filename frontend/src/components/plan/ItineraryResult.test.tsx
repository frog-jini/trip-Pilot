// onXxx 콜백들이 전부 optional인 컴포넌트라(ItineraryResult.tsx 참고), "콜백 없이 렌더링하면
// 관련 버튼/입력창 자체가 안 보인다"는 것과 "콜백을 주면 정상 동작한다"는 것을 각각 검증한다.
// 비용/시간 입력은 fireEvent.change를 쓰는데, userEvent.type은 number/time input에서 브라우저의
// 세그먼트 단위 입력 방식과 안 맞아 신뢰할 수 없기 때문이다.
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ItineraryResult } from './ItineraryResult'
import { LanguageProvider } from '../../context/LanguageContext'
import { writeStoredLanguage } from '../../lib/i18n/languageStorage'
import type { TripItinerary } from '../../lib/tripPlan'

const itinerary: TripItinerary = {
  destination: '일본 도쿄',
  duration: '2박 3일',
  travelers: 2,
  budget: 100,
  days: [
    { day: 1, title: '1일차', activities: ['아사쿠사 관광', '대형 쇼핑몰 쇼핑'] },
    { day: 2, title: '2일차', activities: ['현지 맛집 탐방'] },
    { day: 3, title: '3일차', activities: ['긴자 산책'] },
  ],
}

describe('ItineraryResult', () => {
  it('links each activity to a Google Maps search for that place and destination', () => {
    render(<ItineraryResult itinerary={itinerary} />)

    const link = screen.getByRole('link', { name: '아사쿠사 관광 지도에서 보기' })
    expect(link).toHaveAttribute(
      'href',
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('아사쿠사 관광 일본 도쿄')}`,
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders the destination and duration', () => {
    render(<ItineraryResult itinerary={itinerary} />)
    expect(screen.getByText(/일본 도쿄/)).toBeInTheDocument()
    expect(screen.getByText(/2박 3일/)).toBeInTheDocument()
  })

  it('renders every day title', () => {
    render(<ItineraryResult itinerary={itinerary} />)
    expect(screen.getByRole('heading', { name: '1일차' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2일차' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '3일차' })).toBeInTheDocument()
  })

  it('renders the activities for each day', () => {
    render(<ItineraryResult itinerary={itinerary} />)
    expect(screen.getByText('아사쿠사 관광')).toBeInTheDocument()
    expect(screen.getByText('대형 쇼핑몰 쇼핑')).toBeInTheDocument()
    expect(screen.getByText('현지 맛집 탐방')).toBeInTheDocument()
    expect(screen.getByText('긴자 산책')).toBeInTheDocument()
  })

  it('does not render remove buttons when onRemoveActivity is not provided', () => {
    render(<ItineraryResult itinerary={itinerary} />)
    expect(screen.queryByRole('button', { name: /삭제/ })).not.toBeInTheDocument()
  })

  it('calls onRemoveActivity with the day number and activity when a remove button is clicked', async () => {
    const user = userEvent.setup()
    const onRemoveActivity = vi.fn()
    render(<ItineraryResult itinerary={itinerary} onRemoveActivity={onRemoveActivity} />)

    await user.click(screen.getByRole('button', { name: '아사쿠사 관광 삭제' }))

    expect(onRemoveActivity).toHaveBeenCalledWith(1, '아사쿠사 관광')
  })

  it('does not render favorite buttons when onToggleFavorite is not provided', () => {
    render(<ItineraryResult itinerary={itinerary} />)
    expect(screen.queryByRole('button', { name: /즐겨찾기/ })).not.toBeInTheDocument()
  })

  it('shows an inactive favorite button for an activity that is not favorited', () => {
    render(<ItineraryResult itinerary={itinerary} onToggleFavorite={vi.fn()} />)

    const button = screen.getByRole('button', { name: '아사쿠사 관광 즐겨찾기 추가' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows an active favorite button for an activity already in favoriteActivities', () => {
    render(
      <ItineraryResult
        itinerary={itinerary}
        onToggleFavorite={vi.fn()}
        favoriteActivities={['아사쿠사 관광']}
      />,
    )

    const button = screen.getByRole('button', { name: '아사쿠사 관광 즐겨찾기 해제' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onToggleFavorite with the activity when the favorite button is clicked', async () => {
    const user = userEvent.setup()
    const onToggleFavorite = vi.fn()
    render(<ItineraryResult itinerary={itinerary} onToggleFavorite={onToggleFavorite} />)

    await user.click(screen.getByRole('button', { name: '아사쿠사 관광 즐겨찾기 추가' }))

    expect(onToggleFavorite).toHaveBeenCalledWith('아사쿠사 관광')
  })

  it('does not render a "다른 옵션" toggle when onSwapActivity is not provided', () => {
    render(<ItineraryResult itinerary={itinerary} />)
    expect(screen.queryByRole('button', { name: /다른 옵션/ })).not.toBeInTheDocument()
  })

  it('shows concrete swap options when the "다른 옵션" toggle is clicked', async () => {
    const user = userEvent.setup()
    const getSwapOptions = vi.fn().mockReturnValue(['센소지 (아사쿠사)', '도쿄타워 (미나토구)'])
    render(<ItineraryResult itinerary={itinerary} onSwapActivity={vi.fn()} getSwapOptions={getSwapOptions} />)

    await user.click(screen.getByRole('button', { name: '아사쿠사 관광 다른 옵션 보기' }))

    expect(getSwapOptions).toHaveBeenCalledWith('아사쿠사 관광', 1)
    expect(screen.getByRole('button', { name: '센소지 (아사쿠사) 선택' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '도쿄타워 (미나토구) 선택' })).toBeInTheDocument()
  })

  it('calls onSwapActivity with the day, old activity, and the chosen option', async () => {
    const user = userEvent.setup()
    const onSwapActivity = vi.fn()
    const getSwapOptions = vi.fn().mockReturnValue(['센소지 (아사쿠사)'])
    render(
      <ItineraryResult itinerary={itinerary} onSwapActivity={onSwapActivity} getSwapOptions={getSwapOptions} />,
    )

    await user.click(screen.getByRole('button', { name: '아사쿠사 관광 다른 옵션 보기' }))
    await user.click(screen.getByRole('button', { name: '센소지 (아사쿠사) 선택' }))

    expect(onSwapActivity).toHaveBeenCalledWith(1, '아사쿠사 관광', '센소지 (아사쿠사)')
  })

  it('does not show a swap toggle when there are no alternatives for that activity', () => {
    const getSwapOptions = vi.fn().mockReturnValue([])
    render(<ItineraryResult itinerary={itinerary} onSwapActivity={vi.fn()} getSwapOptions={getSwapOptions} />)

    expect(screen.queryByRole('button', { name: '아사쿠사 관광 다른 옵션 보기' })).not.toBeInTheDocument()
  })

  it('does not render an edit button when onEditActivity is not provided', () => {
    render(<ItineraryResult itinerary={itinerary} />)
    expect(screen.queryByRole('button', { name: /직접 수정/ })).not.toBeInTheDocument()
  })

  it('shows an editable text field pre-filled with the activity when the edit button is clicked', async () => {
    const user = userEvent.setup()
    render(<ItineraryResult itinerary={itinerary} onEditActivity={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '아사쿠사 관광 직접 수정' }))

    expect(screen.getByRole('textbox', { name: '아사쿠사 관광 수정 입력' })).toHaveValue('아사쿠사 관광')
  })

  it('calls onEditActivity with the day, old activity, and the new text when saved', async () => {
    const user = userEvent.setup()
    const onEditActivity = vi.fn()
    render(<ItineraryResult itinerary={itinerary} onEditActivity={onEditActivity} />)

    await user.click(screen.getByRole('button', { name: '아사쿠사 관광 직접 수정' }))
    const input = screen.getByRole('textbox', { name: '아사쿠사 관광 수정 입력' })
    await user.clear(input)
    await user.type(input, '우에노 공원 산책')
    await user.click(screen.getByRole('button', { name: '수정' }))

    expect(onEditActivity).toHaveBeenCalledWith(1, '아사쿠사 관광', '우에노 공원 산책')
  })

  it('closes the edit field without saving when cancelled', async () => {
    const user = userEvent.setup()
    const onEditActivity = vi.fn()
    render(<ItineraryResult itinerary={itinerary} onEditActivity={onEditActivity} />)

    await user.click(screen.getByRole('button', { name: '아사쿠사 관광 직접 수정' }))
    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(onEditActivity).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: '아사쿠사 관광 수정 입력' })).not.toBeInTheDocument()
    expect(screen.getByText('아사쿠사 관광')).toBeInTheDocument()
  })

  it('does not save an empty edit', async () => {
    const user = userEvent.setup()
    const onEditActivity = vi.fn()
    render(<ItineraryResult itinerary={itinerary} onEditActivity={onEditActivity} />)

    await user.click(screen.getByRole('button', { name: '아사쿠사 관광 직접 수정' }))
    const input = screen.getByRole('textbox', { name: '아사쿠사 관광 수정 입력' })
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: '수정' }))

    expect(onEditActivity).not.toHaveBeenCalled()
  })

  it('shows the calendar date next to a day title when the day has a date', () => {
    const datedItinerary: TripItinerary = {
      ...itinerary,
      days: [{ day: 1, title: '1일차', activities: ['아사쿠사 관광'], date: '2026-07-25' }],
    }
    render(<ItineraryResult itinerary={datedItinerary} />)

    expect(screen.getByRole('heading', { name: '1일차' })).toBeInTheDocument()
    expect(screen.getByText('7월 25일 (토)')).toBeInTheDocument()
  })

  it('does not show a calendar date when the day has no date', () => {
    render(<ItineraryResult itinerary={itinerary} />)
    expect(screen.queryByText(/\d+월 \d+일/)).not.toBeInTheDocument()
  })

  it('shows a simulated time next to each activity, in order', () => {
    render(<ItineraryResult itinerary={itinerary} />)
    // Day 1 has two activities: 09:00 for the first, 11:00 for the second.
    expect(screen.getAllByText('09:00').length).toBeGreaterThan(0)
    expect(screen.getByText('11:00')).toBeInTheDocument()
  })

  it('still renders the activity text intact alongside its scheduled time', () => {
    render(<ItineraryResult itinerary={itinerary} />)
    expect(screen.getByText('아사쿠사 관광')).toBeInTheDocument()
  })

  it('labels a 맛집 중심 activity landing in a meal window with its meal name', () => {
    const mealItinerary: TripItinerary = {
      destination: '평행우주 도시',
      duration: '1박 2일',
      travelers: 1,
      budget: 50,
      days: [{ day: 1, title: '1일차', activities: ['대표 랜드마크 관광', '현지 맛집 탐방'] }],
    }
    render(<ItineraryResult itinerary={mealItinerary} />)

    expect(screen.getByText('11:00')).toBeInTheDocument()
    expect(screen.getByText('점심')).toBeInTheDocument()
  })

  it('shows the forecast summary next to a day that has a matching entry in forecastsByDate', () => {
    const datedItinerary: TripItinerary = {
      ...itinerary,
      days: [{ day: 1, title: '1일차', activities: ['아사쿠사 관광'], date: '2026-07-25' }],
    }
    render(
      <ItineraryResult
        itinerary={datedItinerary}
        forecastsByDate={{
          '2026-07-25': {
            date: '2026-07-25',
            condition: 'rainy',
            maxTemperature: 26,
            minTemperature: 20,
            precipitation: 12.4,
          },
        }}
      />,
    )

    expect(screen.getByText('🌧️ 최고 26° · 최저 20° · 강수 12.4mm')).toBeInTheDocument()
  })

  it('does not show a forecast summary when there is no matching forecast for the day', () => {
    const datedItinerary: TripItinerary = {
      ...itinerary,
      days: [{ day: 1, title: '1일차', activities: ['아사쿠사 관광'], date: '2026-07-25' }],
    }
    render(<ItineraryResult itinerary={datedItinerary} forecastsByDate={{}} />)

    expect(screen.queryByText(/최고/)).not.toBeInTheDocument()
  })

  it('does not render an add-day button when onAddDay is not provided', () => {
    render(<ItineraryResult itinerary={itinerary} />)
    expect(screen.queryByRole('button', { name: '일정 추가' })).not.toBeInTheDocument()
  })

  it('renders an add-day button when onAddDay is provided', () => {
    render(<ItineraryResult itinerary={itinerary} onAddDay={vi.fn()} />)
    expect(screen.getByRole('button', { name: '일정 추가' })).toBeInTheDocument()
  })

  it('calls onAddDay when the add-day button is clicked', async () => {
    const user = userEvent.setup()
    const onAddDay = vi.fn()
    render(<ItineraryResult itinerary={itinerary} onAddDay={onAddDay} />)

    await user.click(screen.getByRole('button', { name: '일정 추가' }))

    expect(onAddDay).toHaveBeenCalled()
  })

  it('does not render a per-day add-activity button when onAddActivity is not provided', () => {
    render(<ItineraryResult itinerary={itinerary} />)
    expect(screen.queryByRole('button', { name: /활동 추가/ })).not.toBeInTheDocument()
  })

  it('renders a per-day add-activity button for each day when onAddActivity is provided', () => {
    render(<ItineraryResult itinerary={itinerary} onAddActivity={vi.fn()} />)

    expect(screen.getByRole('button', { name: '1일차 활동 추가' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2일차 활동 추가' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3일차 활동 추가' })).toBeInTheDocument()
  })

  it('calls onAddActivity with the day number when its add-activity button is clicked', async () => {
    const user = userEvent.setup()
    const onAddActivity = vi.fn()
    render(<ItineraryResult itinerary={itinerary} onAddActivity={onAddActivity} />)

    await user.click(screen.getByRole('button', { name: '2일차 활동 추가' }))

    expect(onAddActivity).toHaveBeenCalledWith(2)
  })

  it('keeps the add-activity button enabled while the day still has room before midnight', () => {
    render(<ItineraryResult itinerary={itinerary} onAddActivity={vi.fn()} />)
    expect(screen.getByRole('button', { name: '1일차 활동 추가' })).toBeEnabled()
  })

  it('disables the add-activity button and explains why once the day is full', () => {
    const fullDayItinerary: TripItinerary = {
      ...itinerary,
      days: [
        {
          day: 1,
          title: '1일차',
          activities: Array.from({ length: 9 }, (_, i) => `활동 ${i + 1}`),
        },
      ],
    }
    render(<ItineraryResult itinerary={fullDayItinerary} onAddActivity={vi.fn()} />)

    const button = screen.getByRole('button', { name: '1일차 일정이 가득 찼어요' })
    expect(button).toBeDisabled()
  })

  it('shows a budget summary with each day at zero when no costs have been entered', () => {
    render(<ItineraryResult itinerary={itinerary} />)

    expect(screen.getByText('1일차 0원 사용')).toBeInTheDocument()
    expect(screen.getByText('2일차 0원 사용')).toBeInTheDocument()
    expect(screen.getByText('3일차 0원 사용')).toBeInTheDocument()
    expect(screen.getByText('총 여행경비 0원 · 예산 1,000,000원 중 1,000,000원 남았어요')).toBeInTheDocument()
  })

  it('includes every entered cost in the day and trip totals', () => {
    const costItinerary: TripItinerary = {
      ...itinerary,
      days: [
        { day: 1, title: '1일차', activities: ['도쿄 디즈니랜드 (우라야스)', '아사쿠사 관광'] },
        { day: 2, title: '2일차', activities: ['현지 맛집 탐방'] },
        { day: 3, title: '3일차', activities: ['긴자 산책'] },
      ],
    }
    render(
      <ItineraryResult
        itinerary={costItinerary}
        costs={{
          1: { '도쿄 디즈니랜드 (우라야스)': 120000, '아사쿠사 관광': 5000 },
          2: { '현지 맛집 탐방': 45000 },
        }}
      />,
    )

    expect(screen.getByText('1일차 125,000원 사용')).toBeInTheDocument()
    expect(screen.getByText('2일차 45,000원 사용')).toBeInTheDocument()
    expect(screen.getByText('3일차 0원 사용')).toBeInTheDocument()
    expect(screen.getByText('총 여행경비 170,000원 · 예산 1,000,000원 중 830,000원 남았어요')).toBeInTheDocument()
  })

  it('warns when the total travel cost goes over budget', () => {
    const overBudgetItinerary: TripItinerary = { ...itinerary, budget: 1 }
    render(<ItineraryResult itinerary={overBudgetItinerary} costs={{ 1: { '아사쿠사 관광': 50000 } }} />)

    expect(screen.getByText('총 여행경비 50,000원 · 예산보다 40,000원 초과했어요')).toBeInTheDocument()
  })

  it('does not render a cost input when onSetActivityCost is not provided', () => {
    render(<ItineraryResult itinerary={itinerary} />)
    expect(screen.queryByRole('spinbutton', { name: /비용 입력/ })).not.toBeInTheDocument()
  })

  it('renders an editable cost input for every activity when onSetActivityCost is provided', () => {
    const themeParkItinerary: TripItinerary = {
      ...itinerary,
      days: [{ day: 1, title: '1일차', activities: ['도쿄 디즈니랜드 (우라야스)'] }],
    }
    render(<ItineraryResult itinerary={themeParkItinerary} onSetActivityCost={vi.fn()} />)

    const input = screen.getByRole('spinbutton', { name: '도쿄 디즈니랜드 (우라야스) 비용 입력' })
    expect(input).toBeEnabled()
    expect(input).toHaveValue(null)
  })

  it('pre-fills the cost input with the amount already entered for that activity', () => {
    render(
      <ItineraryResult
        itinerary={itinerary}
        costs={{ 1: { '아사쿠사 관광': 5000 } }}
        onSetActivityCost={vi.fn()}
      />,
    )
    expect(screen.getByRole('spinbutton', { name: '아사쿠사 관광 비용 입력' })).toHaveValue(5000)
  })

  it('calls onSetActivityCost with the day, activity, and entered amount', () => {
    const onSetActivityCost = vi.fn()
    render(<ItineraryResult itinerary={itinerary} onSetActivityCost={onSetActivityCost} />)

    const input = screen.getByRole('spinbutton', { name: '아사쿠사 관광 비용 입력' })
    fireEvent.change(input, { target: { value: '5000' } })

    expect(onSetActivityCost).toHaveBeenLastCalledWith(1, '아사쿠사 관광', 5000)
  })

  it('does not render an editable time input when onSetActivityTime is not provided', () => {
    render(<ItineraryResult itinerary={itinerary} />)
    expect(screen.queryByLabelText(/시간 입력/)).not.toBeInTheDocument()
  })

  it('renders an editable time input pre-filled with the computed time when onSetActivityTime is provided', () => {
    render(<ItineraryResult itinerary={itinerary} onSetActivityTime={vi.fn()} />)

    const input = screen.getByLabelText('아사쿠사 관광 시간 입력')
    expect(input).toBeEnabled()
    expect(input).toHaveValue('09:00')
  })

  it('pre-fills the time input with a previously set custom time instead of the computed one', () => {
    render(
      <ItineraryResult
        itinerary={itinerary}
        times={{ 1: { '아사쿠사 관광': '10:45' } }}
        onSetActivityTime={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('아사쿠사 관광 시간 입력')).toHaveValue('10:45')
  })

  it('calls onSetActivityTime with the day, activity, and entered time', () => {
    const onSetActivityTime = vi.fn()
    render(<ItineraryResult itinerary={itinerary} onSetActivityTime={onSetActivityTime} />)

    const input = screen.getByLabelText('아사쿠사 관광 시간 입력')
    fireEvent.change(input, { target: { value: '13:15' } })

    expect(onSetActivityTime).toHaveBeenLastCalledWith(1, '아사쿠사 관광', '13:15')
  })

  it('does not call onAddActivity when the disabled full-day button is clicked', async () => {
    const user = userEvent.setup()
    const onAddActivity = vi.fn()
    const fullDayItinerary: TripItinerary = {
      ...itinerary,
      days: [
        {
          day: 1,
          title: '1일차',
          activities: Array.from({ length: 9 }, (_, i) => `활동 ${i + 1}`),
        },
      ],
    }
    render(<ItineraryResult itinerary={fullDayItinerary} onAddActivity={onAddActivity} />)

    await user.click(screen.getByRole('button', { name: '1일차 일정이 가득 찼어요' }))

    expect(onAddActivity).not.toHaveBeenCalled()
  })
})

describe('ItineraryResult language switching', () => {
  afterEach(() => {
    localStorage.clear()
  })

  function renderWithLanguage(tripItinerary: TripItinerary) {
    return render(
      <LanguageProvider>
        <ItineraryResult itinerary={tripItinerary} />
      </LanguageProvider>,
    )
  }

  it('translates the duration when the language is English', () => {
    writeStoredLanguage('en')
    renderWithLanguage(itinerary)
    expect(screen.getByText(/2 Nights 3 Days/)).toBeInTheDocument()
    expect(screen.queryByText(/2박 3일/)).not.toBeInTheDocument()
  })

  it('translates the destination name (not just the duration) when the language is English', () => {
    writeStoredLanguage('en')
    renderWithLanguage(itinerary)
    expect(screen.getByRole('heading', { name: /Tokyo, Japan/ })).toBeInTheDocument()
    expect(screen.queryByText(/일본 도쿄/)).not.toBeInTheDocument()
  })

  it('translates a catalog-backed activity name when the language is English', () => {
    writeStoredLanguage('en')
    const tokyoItinerary: TripItinerary = {
      ...itinerary,
      days: [{ day: 1, title: '1일차', activities: ['센소지 (아사쿠사)'] }],
    }
    renderWithLanguage(tokyoItinerary)
    expect(screen.getByText('Sensoji Temple (Asakusa)')).toBeInTheDocument()
  })

  it('translates a catalog-backed activity name when the language is Japanese', () => {
    writeStoredLanguage('ja')
    const tokyoItinerary: TripItinerary = {
      ...itinerary,
      days: [{ day: 1, title: '1일차', activities: ['센소지 (아사쿠사)'] }],
    }
    renderWithLanguage(tokyoItinerary)
    expect(screen.getByText('浅草寺(浅草)')).toBeInTheDocument()
  })

  it('translates a generic style-pool activity name for a destination without a catalog', () => {
    writeStoredLanguage('en')
    const genericItinerary: TripItinerary = {
      ...itinerary,
      destination: '평행우주 도시',
      days: [{ day: 1, title: '1일차', activities: ['대표 랜드마크 관광'] }],
    }
    renderWithLanguage(genericItinerary)
    expect(screen.getByText('Iconic Landmark Sightseeing')).toBeInTheDocument()
  })

  it('translates catalog activities even when the destination is a variant like "제주도" (not the canonical "제주")', () => {
    writeStoredLanguage('en')
    const jejuItinerary: TripItinerary = {
      ...itinerary,
      destination: '제주도',
      days: [{ day: 1, title: '1일차', activities: ['성산일출봉 (성산읍)'] }],
    }
    renderWithLanguage(jejuItinerary)
    expect(screen.getByText('Seongsan Ilchulbong (Seongsan-eup)')).toBeInTheDocument()
    expect(screen.queryByText('성산일출봉 (성산읍)')).not.toBeInTheDocument()
  })

  it('leaves a free-text (chat-added) activity name unchanged when translated', () => {
    writeStoredLanguage('en')
    const customItinerary: TripItinerary = {
      ...itinerary,
      days: [{ day: 1, title: '1일차', activities: ['디즈니랜드'] }],
    }
    renderWithLanguage(customItinerary)
    expect(screen.getByText('디즈니랜드')).toBeInTheDocument()
  })
})
