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

  it('multiplies a per-person budget ("각 ~씩") by the known traveler count into a total', () => {
    const current = { ...baseValues(), travelers: '2' }
    expect(parseTripPlanMessage('각 50만원씩', current).budget).toBe('100')
  })

  it('multiplies a per-person budget by travelers extracted from the same message', () => {
    expect(parseTripPlanMessage('3명이서 각 50만원씩', baseValues()).budget).toBe('150')
  })

  it('does not multiply a plain total budget even when travelers is already known', () => {
    const current = { ...baseValues(), travelers: '2' }
    expect(parseTripPlanMessage('예산은 100만원이야', current).budget).toBe('100')
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

  it('applies a bare-number reply to travelers when that is the pending question', () => {
    const current: TripPlanFormValues = { ...baseValues(), destination: '일본 도쿄' }
    expect(parseTripPlanMessage('3', current).travelers).toBe('3')
  })

  it('applies a bare-number reply to budget when that is the pending question', () => {
    const current: TripPlanFormValues = { ...baseValues(), destination: '일본 도쿄', travelers: '2' }
    expect(parseTripPlanMessage('100', current).budget).toBe('100')
  })

  it('does not apply a bare number to travelers when destination is still the pending question', () => {
    expect(parseTripPlanMessage('3', baseValues()).travelers).toBe('')
  })

  it('does not mistake a duration number for the pending travelers answer', () => {
    const current: TripPlanFormValues = { ...baseValues(), destination: '일본 도쿄' }
    const result = parseTripPlanMessage('2박 3일이요', current)
    expect(result.duration).toBe('2박 3일')
    expect(result.travelers).toBe('')
  })
})

describe('parseTripPlanMessage in English', () => {
  it('extracts a known destination', () => {
    expect(parseTripPlanMessage('I want to go to Tokyo', baseValues(), 'en').destination).toBe('일본 도쿄')
  })

  it('extracts duration regardless of nights/days order', () => {
    expect(parseTripPlanMessage('2 nights 3 days trip', baseValues(), 'en').duration).toBe('2박 3일')
    expect(parseTripPlanMessage('3 days 2 nights trip', baseValues(), 'en').duration).toBe('2박 3일')
  })

  it('extracts traveler count', () => {
    expect(parseTripPlanMessage('3 people', baseValues(), 'en').travelers).toBe('3')
  })

  it('extracts a travel style', () => {
    expect(parseTripPlanMessage('mostly shopping please', baseValues(), 'en').styles).toEqual(['쇼핑 중심'])
  })

  it('applies a bare-number reply to travelers when that is the pending question', () => {
    const current: TripPlanFormValues = { ...baseValues(), destination: '일본 도쿄' }
    expect(parseTripPlanMessage('3', current, 'en').travelers).toBe('3')
  })

  it('extracts budget from a total KRW amount (matching the en questionBudget/placeholder prompt)', () => {
    expect(parseTripPlanMessage('budget 1,000,000 KRW', baseValues(), 'en').budget).toBe('100')
  })

  it('also accepts budget answered as a total amount without commas', () => {
    expect(parseTripPlanMessage('budget is 1000000 won', baseValues(), 'en').budget).toBe('100')
  })

  it('also accepts budget answered in "man won" units', () => {
    expect(parseTripPlanMessage('budget is 100 man won', baseValues(), 'en').budget).toBe('100')
  })
})

describe('parseTripPlanMessage in Japanese', () => {
  it('extracts a known destination', () => {
    expect(parseTripPlanMessage('大阪に行きたいです', baseValues(), 'ja').destination).toBe('오사카')
  })

  it('extracts duration in N泊M日 form', () => {
    expect(parseTripPlanMessage('2泊3日で行きたい', baseValues(), 'ja').duration).toBe('2박 3일')
  })

  it('extracts traveler count', () => {
    expect(parseTripPlanMessage('3人で行きます', baseValues(), 'ja').travelers).toBe('3')
  })

  it('extracts a travel style', () => {
    expect(parseTripPlanMessage('グルメ中心でお願いします', baseValues(), 'ja').styles).toEqual(['맛집 중심'])
  })

  it('applies a bare-number reply to travelers when that is the pending question', () => {
    const current: TripPlanFormValues = { ...baseValues(), destination: '일본 도쿄' }
    expect(parseTripPlanMessage('3', current, 'ja').travelers).toBe('3')
  })

  it('extracts budget in 万ウォン units (matching the ja questionBudget prompt)', () => {
    expect(parseTripPlanMessage('予算は100万ウォンです', baseValues(), 'ja').budget).toBe('100')
  })

  it('also accepts budget answered in 万円', () => {
    expect(parseTripPlanMessage('予算は100万円です', baseValues(), 'ja').budget).toBe('100')
  })

  it('recognizes full-width (全角) digits', () => {
    const result = parseTripPlanMessage('３人で、予算は１００万ウォンです', baseValues(), 'ja')
    expect(result.travelers).toBe('3')
    expect(result.budget).toBe('100')
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
