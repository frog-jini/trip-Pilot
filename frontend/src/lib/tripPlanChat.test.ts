// 규칙 기반 여행 조건 파서(parseTripPlanMessage)와, 그 결과가 불완전할 때만 AI를 보조로 부르는
// parseTripPlanMessageWithAi(타임아웃/폴백 포함)를 검증한다.
import { todayIso } from './dateUtils'
import { emptyTripPlanFormValues, type TripPlanFormValues } from './tripPlan'
import {
  isTripPlanReady,
  nextTripPlanQuestion,
  parseTripPlanMessage,
  parseTripPlanMessageWithAi,
} from './tripPlanChat'

function baseValues(): TripPlanFormValues {
  return { ...emptyTripPlanFormValues, startDate: todayIso() }
}

describe('parseTripPlanMessage', () => {
  it('extracts a known destination', () => {
    expect(parseTripPlanMessage('도쿄로 여행 가고 싶어', baseValues()).destination).toBe('일본 도쿄')
  })

  it('extracts duration in N박 M일 form, with or without spaces', () => {
    expect(parseTripPlanMessage('2박3일로 갈래', baseValues()).duration).toBe('2박 3일')
    expect(parseTripPlanMessage('3박 4일 일정', baseValues()).duration).toBe('3박 4일')
  })

  it('extracts traveler count', () => {
    expect(parseTripPlanMessage('2명이서 가요', baseValues()).travelers).toBe('2')
  })

  it('extracts budget in 만원 units', () => {
    expect(parseTripPlanMessage('예산은 100만원이야', baseValues()).budget).toBe('100')
  })

  it('extracts a single travel style', () => {
    expect(parseTripPlanMessage('쇼핑 위주로 짜줘', baseValues()).styles).toEqual(['쇼핑 중심'])
  })

  it('extracts multiple travel styles from one message', () => {
    const result = parseTripPlanMessage('맛집이랑 쇼핑 위주로', baseValues())
    expect(result.styles).toEqual(expect.arrayContaining(['맛집 중심', '쇼핑 중심']))
    expect(result.styles).toHaveLength(2)
  })

  it('extracts everything from one free-form sentence', () => {
    const result = parseTripPlanMessage('도쿄 2박3일로 쇼핑 위주 일정 짜줘, 예산은 100만원', baseValues())
    expect(result.destination).toBe('일본 도쿄')
    expect(result.duration).toBe('2박 3일')
    expect(result.styles).toEqual(['쇼핑 중심'])
    expect(result.budget).toBe('100')
    expect(result.travelers).toBe('')
  })

  it('keeps previously known fields when a new message only adds one more piece of info', () => {
    const withDestination = parseTripPlanMessage('도쿄로 가고 싶어', baseValues())
    const result = parseTripPlanMessage('2명이요', withDestination)
    expect(result.destination).toBe('일본 도쿄')
    expect(result.travelers).toBe('2')
  })

  it('accumulates styles mentioned across separate messages instead of replacing them', () => {
    const first = parseTripPlanMessage('쇼핑 위주로 해줘', baseValues())
    const second = parseTripPlanMessage('맛집도 좋아해', first)
    expect(second.styles).toEqual(expect.arrayContaining(['쇼핑 중심', '맛집 중심']))
    expect(second.styles).toHaveLength(2)
  })

  it('leaves fields unchanged when nothing new is recognized in the message', () => {
    const withDestination = parseTripPlanMessage('도쿄로 가고 싶어', baseValues())
    const result = parseTripPlanMessage('음... 글쎄요', withDestination)
    expect(result.destination).toBe('일본 도쿄')
  })

  it('recognizes destination aliases such as 제주도 for 제주', () => {
    expect(parseTripPlanMessage('제주도 여행', baseValues()).destination).toBe('제주')
  })
})

describe('nextTripPlanQuestion', () => {
  it('asks for the destination first when nothing is known', () => {
    expect(nextTripPlanQuestion(baseValues())).toBe('plan.questionDestination')
  })

  it('asks for travelers once destination, budget, and styles are known but travelers is missing', () => {
    const values: TripPlanFormValues = {
      ...baseValues(),
      destination: '일본 도쿄',
      budget: '100',
      styles: ['쇼핑 중심'],
    }
    expect(nextTripPlanQuestion(values)).toBe('plan.questionTravelers')
  })

  it('asks for budget when only budget is missing', () => {
    const values: TripPlanFormValues = {
      ...baseValues(),
      destination: '일본 도쿄',
      travelers: '2',
      styles: ['쇼핑 중심'],
    }
    expect(nextTripPlanQuestion(values)).toBe('plan.questionBudget')
  })

  it('asks for a travel style when only styles is missing', () => {
    const values: TripPlanFormValues = {
      ...baseValues(),
      destination: '일본 도쿄',
      travelers: '2',
      budget: '100',
    }
    expect(nextTripPlanQuestion(values)).toBe('plan.questionStyles')
  })

  it('returns null once every required field is filled in', () => {
    const values: TripPlanFormValues = {
      ...baseValues(),
      destination: '일본 도쿄',
      travelers: '2',
      budget: '100',
      styles: ['쇼핑 중심'],
    }
    expect(nextTripPlanQuestion(values)).toBeNull()
  })
})

describe('parseTripPlanMessageWithAi', () => {
  it('never calls the AI when the rule-based parser already recognized everything needed', async () => {
    const complete = vi.fn().mockResolvedValue('{}')

    const result = await parseTripPlanMessageWithAi(
      '도쿄 2박3일로 쇼핑 위주 일정 짜줘, 2명이서 예산은 100만원',
      baseValues(),
      complete,
    )

    expect(complete).not.toHaveBeenCalled()
    expect(result.destination).toBe('일본 도쿄')
    expect(result.duration).toBe('2박 3일')
    expect(result.travelers).toBe('2')
    expect(result.budget).toBe('100')
    expect(result.styles).toEqual(['쇼핑 중심'])
  })

  it('keeps the rule-based recognition even if the AI never gets a chance to run, whatever phrasing was used', async () => {
    // Regression: previously the AI was the *only* extraction path when loaded, so a slow
    // or hanging AI meant even exactly-formatted input like this never got recognized.
    const complete = vi.fn().mockReturnValue(new Promise(() => {}))
    vi.useFakeTimers()

    const resultPromise = parseTripPlanMessageWithAi(
      '도쿄 2박3일로 쇼핑 위주 일정 짜줘, 예산은 100만원',
      baseValues(),
      complete,
    )
    await vi.advanceTimersByTimeAsync(20000)
    const result = await resultPromise

    expect(result.destination).toBe('일본 도쿄')
    expect(result.duration).toBe('2박 3일')
    expect(result.styles).toEqual(['쇼핑 중심'])
    expect(result.budget).toBe('100')

    vi.useRealTimers()
  })

  it('calls the AI to fill in gaps when the rule-based parser could not recognize everything', async () => {
    const complete = vi.fn().mockResolvedValue(
      JSON.stringify({ destination: null, duration: null, travelers: '2', budget: '100', styles: [] }),
    )

    // Free-form phrasing the rule-based regexes cannot parse (no digits, no known keywords).
    const result = await parseTripPlanMessageWithAi('음 아무데나 재밌는 데로 데려가줘', baseValues(), complete)

    expect(complete).toHaveBeenCalled()
    expect(result.travelers).toBe('2')
    expect(result.budget).toBe('100')
  })

  it('passes a system prompt and the user message to the completion function', async () => {
    const complete = vi.fn().mockResolvedValue('{}')

    await parseTripPlanMessageWithAi('음 아무데나 재밌는 데로 데려가줘', baseValues(), complete)

    const [messages] = complete.mock.calls[0]
    expect(messages[0].role).toBe('system')
    expect(messages[1]).toEqual({ role: 'user', content: '음 아무데나 재밌는 데로 데려가줘' })
  })

  it('keeps previously known values for fields the AI returns as null', async () => {
    const complete = vi.fn().mockResolvedValue(
      JSON.stringify({ destination: null, duration: null, travelers: '2', budget: null, styles: [] }),
    )
    const current: TripPlanFormValues = { ...baseValues(), destination: '일본 도쿄' }

    const result = await parseTripPlanMessageWithAi('음 아무튼 그런 느낌으로', current, complete)

    expect(result.destination).toBe('일본 도쿄')
    expect(result.travelers).toBe('2')
  })

  it('accumulates styles instead of replacing previously known ones', async () => {
    const complete = vi.fn().mockResolvedValue(JSON.stringify({ travelers: '2', styles: ['맛집 중심'] }))
    const current: TripPlanFormValues = { ...baseValues(), styles: ['쇼핑 중심'] }

    const result = await parseTripPlanMessageWithAi('음 아무튼 맛있는 것도 좋아', current, complete)

    expect(result.styles).toEqual(expect.arrayContaining(['쇼핑 중심', '맛집 중심']))
    expect(result.styles).toHaveLength(2)
  })

  it('ignores a hallucinated duration or style value that is not one of the allowed options', async () => {
    const complete = vi.fn().mockResolvedValue(
      JSON.stringify({ duration: '10박 11일', travelers: '2', styles: ['익스트림 스포츠 중심'] }),
    )

    const result = await parseTripPlanMessageWithAi('음 아무튼 알아서 해줘', baseValues(), complete)

    expect(result.duration).toBe(baseValues().duration)
    expect(result.styles).toEqual([])
  })

  it('falls back to rule-based parsing when the AI response is not valid JSON', async () => {
    const complete = vi.fn().mockResolvedValue('죄송해요, 다시 한 번 말씀해주시겠어요?')

    const result = await parseTripPlanMessageWithAi('도쿄 2박3일로 쇼핑 위주', baseValues(), complete)

    expect(result.destination).toBe('일본 도쿄')
    expect(result.duration).toBe('2박 3일')
    expect(result.styles).toEqual(['쇼핑 중심'])
  })

  it('falls back to rule-based parsing when the completion function throws', async () => {
    const complete = vi.fn().mockRejectedValue(new Error('model not loaded'))

    const result = await parseTripPlanMessageWithAi('도쿄로 가고 싶어', baseValues(), complete)

    expect(result.destination).toBe('일본 도쿄')
  })

  it('falls back to rule-based parsing instead of hanging forever when the AI never responds', async () => {
    vi.useFakeTimers()
    const complete = vi.fn().mockReturnValue(new Promise(() => {}))

    const resultPromise = parseTripPlanMessageWithAi('도쿄 2박3일로 쇼핑 위주', baseValues(), complete)
    await vi.advanceTimersByTimeAsync(20000)
    const result = await resultPromise

    expect(result.destination).toBe('일본 도쿄')
    expect(result.duration).toBe('2박 3일')
    expect(result.styles).toEqual(['쇼핑 중심'])

    vi.useRealTimers()
  })
})

describe('isTripPlanReady', () => {
  it('is false when required fields are missing', () => {
    expect(isTripPlanReady(baseValues())).toBe(false)
  })

  it('is true once destination, travelers, budget, and styles are all set', () => {
    const values: TripPlanFormValues = {
      ...baseValues(),
      destination: '일본 도쿄',
      travelers: '2',
      budget: '100',
      styles: ['쇼핑 중심'],
    }
    expect(isTripPlanReady(values)).toBe(true)
  })
})
