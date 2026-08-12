// 로컬 LLM에게 보낼 시스템 프롬프트 생성, 모델 응답 JSON 파싱/검증, 그리고 타임아웃·에러
// 폴백까지 포함한 resolveTripChatActionWithAi 전체 흐름을 가짜 complete 함수로 검증한다.
import {
  buildTripChatSystemPrompt,
  parseTripChatActionJson,
  resolveTripChatActionWithAi,
} from './tripChatAction'
import type { TripItinerary } from './tripPlan'

const itinerary: TripItinerary = {
  destination: '일본 도쿄',
  duration: '2박 3일',
  travelers: 2,
  budget: 100,
  days: [
    { day: 1, title: '1일차', activities: ['아사쿠사 관광', '도쿄타워'] },
    { day: 2, title: '2일차', activities: ['신주쿠 쇼핑'] },
  ],
}

describe('buildTripChatSystemPrompt', () => {
  it('lists each day and its activities so the AI can resolve references like "그거 빼줘"', () => {
    const prompt = buildTripChatSystemPrompt(itinerary)

    expect(prompt).toContain('1일차: 아사쿠사 관광, 도쿄타워')
    expect(prompt).toContain('2일차: 신주쿠 쇼핑')
  })

  it('describes the JSON action schema the model must follow', () => {
    const prompt = buildTripChatSystemPrompt(itinerary)

    expect(prompt).toContain('add_activity')
    expect(prompt).toContain('remove_activity')
    expect(prompt).toContain('weather')
    expect(prompt).toContain('unknown')
  })

  it('labels an empty day so the model does not confuse it with a missing day', () => {
    const emptyDayItinerary: TripItinerary = {
      ...itinerary,
      days: [{ day: 1, title: '1일차', activities: [] }],
    }
    expect(buildTripChatSystemPrompt(emptyDayItinerary)).toContain('1일차: (활동 없음)')
  })
})

describe('parseTripChatActionJson', () => {
  it('parses a valid add_activity action', () => {
    expect(parseTripChatActionJson(JSON.stringify({ action: 'add_activity', day: 2, activity: '디즈니랜드' }))).toEqual(
      { action: 'add_activity', day: 2, activity: '디즈니랜드' },
    )
  })

  it('parses a valid remove_activity action', () => {
    expect(
      parseTripChatActionJson(JSON.stringify({ action: 'remove_activity', day: 1, activity: '도쿄타워' })),
    ).toEqual({ action: 'remove_activity', day: 1, activity: '도쿄타워' })
  })

  it('parses a valid weather action', () => {
    expect(parseTripChatActionJson(JSON.stringify({ action: 'weather', day: 1, weather: 'rain' }))).toEqual({
      action: 'weather',
      day: 1,
      weather: 'rain',
    })
  })

  it('parses an unknown action', () => {
    expect(parseTripChatActionJson(JSON.stringify({ action: 'unknown' }))).toEqual({ action: 'unknown' })
  })

  it('returns null for malformed JSON', () => {
    expect(parseTripChatActionJson('이건 JSON이 아니에요')).toBeNull()
  })

  it('returns null when the action name is not recognized', () => {
    expect(parseTripChatActionJson(JSON.stringify({ action: 'delete_everything' }))).toBeNull()
  })

  it('returns null when add_activity is missing the activity field', () => {
    expect(parseTripChatActionJson(JSON.stringify({ action: 'add_activity', day: 1 }))).toBeNull()
  })

  it('returns null when weather has an invalid weather value', () => {
    expect(parseTripChatActionJson(JSON.stringify({ action: 'weather', day: 1, weather: '태풍입니다' }))).toBeNull()
  })

  it('returns null when day is not a number', () => {
    expect(
      parseTripChatActionJson(JSON.stringify({ action: 'add_activity', day: '2', activity: '디즈니랜드' })),
    ).toBeNull()
  })
})

describe('resolveTripChatActionWithAi', () => {
  it('sends the system prompt, prior conversation, and the new message, then returns the parsed action', async () => {
    const complete = vi.fn().mockResolvedValue(JSON.stringify({ action: 'add_activity', day: 2, activity: '디즈니랜드' }))
    const priorMessages = [
      { role: 'user' as const, content: '1일차에 도쿄타워 추가해줘' },
      { role: 'assistant' as const, content: "1일차에 '도쿄타워'을(를) 추가했어요." },
    ]

    const action = await resolveTripChatActionWithAi('그럼 2일차에는 디즈니랜드도 넣어줘', itinerary, priorMessages, complete)

    expect(action).toEqual({ action: 'add_activity', day: 2, activity: '디즈니랜드' })

    const [messages] = complete.mock.calls[0]
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('1일차: 아사쿠사 관광, 도쿄타워')
    expect(messages[1]).toEqual(priorMessages[0])
    expect(messages[2]).toEqual(priorMessages[1])
    expect(messages[3]).toEqual({ role: 'user', content: '그럼 2일차에는 디즈니랜드도 넣어줘' })
  })

  it('falls back to unknown when the model response is not valid JSON', async () => {
    const complete = vi.fn().mockResolvedValue('죄송해요, 다시 말씀해주시겠어요?')

    const action = await resolveTripChatActionWithAi('음 아무튼 그거 있잖아', itinerary, [], complete)

    expect(action).toEqual({ action: 'unknown' })
  })

  it('falls back to unknown when the completion call itself fails', async () => {
    const complete = vi.fn().mockRejectedValue(new Error('model not loaded'))

    const action = await resolveTripChatActionWithAi('아무 말', itinerary, [], complete)

    expect(action).toEqual({ action: 'unknown' })
  })

  it('gives up within about a second so a slow response does not feel like the app is frozen', async () => {
    // 실사용 피드백: 15초는 물론 4초도 가상 GPU 환경에서는 "화면이 멈췄다"로 느껴졌다.
    // 서버 LLM(비용 발생)으로 옮기는 대신, 로컬 모델은 유지하되 1초 안에 포기하도록 더 줄였다 —
    // 응답을 못 받으면 그냥 규칙 기반 안내 문구로 넘어가는 게 오래 붙잡는 것보다 낫다는 판단.
    const complete = vi.fn().mockReturnValue(new Promise(() => {}))
    vi.useFakeTimers()

    const resultPromise = resolveTripChatActionWithAi('아무 말', itinerary, [], complete)
    let settled = false
    resultPromise.then(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(1500)

    expect(settled).toBe(true)

    vi.useRealTimers()
  })

  it('falls back to unknown when the model takes too long to respond', async () => {
    const complete = vi.fn().mockReturnValue(new Promise(() => {}))
    vi.useFakeTimers()

    const resultPromise = resolveTripChatActionWithAi('아무 말', itinerary, [], complete)
    await vi.advanceTimersByTimeAsync(20000)
    const action = await resultPromise

    expect(action).toEqual({ action: 'unknown' })

    vi.useRealTimers()
  })

  it('waits out a response that arrives just under the timeout', async () => {
    // 1초 타임아웃이라도, 그보다 빨리 오는 응답까지 버리지는 않는다는 걸 확인한다.
    vi.useFakeTimers()
    const complete = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(JSON.stringify({ action: 'add_activity', day: 1, activity: '디즈니랜드' })), 500)
        }),
    )

    const resultPromise = resolveTripChatActionWithAi('아무 말', itinerary, [], complete)
    await vi.advanceTimersByTimeAsync(500)
    const action = await resultPromise

    expect(action).toEqual({ action: 'add_activity', day: 1, activity: '디즈니랜드' })

    vi.useRealTimers()
  })
})
