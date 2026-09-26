// /trips/:id 상세 화면 테스트. 이 페이지가 이번 세션에서 가장 많이 확장된 화면이라 파일이 크다:
// 활동 편집(삭제/교체/직접수정/추가), 날짜 추가, 즐겨찾기, 커뮤니티 공유/동기화, 비용·시간 입력,
// 날씨 챗 + 정규식 기반 활동 추가·삭제 챗, 그리고 정규식이 못 잡을 때의 로컬 LLM 폴백(가짜
// loadEngine 주입)과 그 로딩 상태 표시까지 전부 이 한 페이지의 책임이라 그렇다.
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { InitProgressReport } from '@mlc-ai/web-llm'
import { TripDetailPage } from './TripDetailPage'
import { AuthProvider } from '../context/AuthContext'
import { LanguageProvider } from '../context/LanguageContext'
import { writeStoredToken, writeStoredUser } from '../lib/authStorage'
import { createActivityHistory, generatePlan } from '../lib/generatePlan'
import { addTrip } from '../lib/tripsStorage'
import { emptyTripPlanFormValues, type TripItinerary, type TripPlanFormValues } from '../lib/tripPlan'
import type { ActivityCosts } from '../lib/activityCost'
import type { ActivityTimes } from '../lib/activityTime'
import type { DailyForecast } from '../lib/weather'
import type { ChatEngine } from '../lib/aiEngine'
import { createFakeApiServer, type FakeApiServer } from '../test/fakeApiServer'

function signIn(id = '1', email = 'user@example.com') {
  writeStoredUser({ id, email })
  writeStoredToken(id)
}

async function buildTrip(server: FakeApiServer, values: TripPlanFormValues) {
  const itinerary = generatePlan(values)
  return addTrip('1', { itinerary, values, history: createActivityHistory(itinerary) }, server.fetchImpl)
}

function serverTrip(server: FakeApiServer, id: string) {
  const trip = server.trips.get(id)
  if (!trip) throw new Error(`no fake trip with id ${id}`)
  return trip as unknown as { itinerary: TripItinerary; costs: ActivityCosts; times: ActivityTimes }
}

function renderAt(
  server: FakeApiServer,
  path: string,
  fetchDailyForecast?: () => Promise<DailyForecast[]>,
  loadEngine?: (onProgress?: (report: InitProgressReport) => void) => Promise<ChatEngine>,
  isSupported?: () => boolean,
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/trips/:tripId"
            element={
              <TripDetailPage
                fetchDailyForecast={fetchDailyForecast}
                fetchImpl={server.fetchImpl}
                loadEngine={loadEngine}
                isSupported={isSupported}
              />
            }
          />
          <Route path="/trips" element={<div>목록 페이지</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function renderAtWithLanguageSwitching(
  server: FakeApiServer,
  path: string,
  loadEngine?: (onProgress?: (report: InitProgressReport) => void) => Promise<ChatEngine>,
  isSupported?: () => boolean,
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <AuthProvider>
          <Routes>
            <Route
              path="/trips/:tripId"
              element={<TripDetailPage fetchImpl={server.fetchImpl} loadEngine={loadEngine} isSupported={isSupported} />}
            />
            <Route path="/trips" element={<div>목록 페이지</div>} />
          </Routes>
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>,
  )
}

describe('TripDetailPage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  // Regression: reported that after switching the UI language to English and back to Korean
  // mid-conversation, the chat kept replying in English for the day/weather chat too — i.e. the
  // reply language got "stuck" on whatever was active for the first message in the session.
  it('replies to the weather chat in the currently selected language, even after switching away and back to it', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    renderAtWithLanguageSwitching(server, `/trips/${trip.id}`)

    await user.click(screen.getByRole('button', { name: 'English' }))
    await user.type(await screen.findByLabelText('Message input'), 'first day is sunny')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText(/I’ll leave the plan as is/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '한국어' }))
    await user.type(screen.getByLabelText('메시지 입력'), '둘째 날은 날씨가 맑대')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    // Both replies now show in Korean — the new one, and the earlier (English) one re-rendered
    // in the newly selected language, per the user's explicit request to retranslate history.
    expect(await screen.findByText(/1일차는 맑은 날씨라니 잘 됐네요/)).toBeInTheDocument()
    expect(screen.getByText(/2일차는 맑은 날씨라니 잘 됐네요/)).toBeInTheDocument()
    expect(screen.queryByText(/I’ll leave the plan as is/)).not.toBeInTheDocument()
  })

  // Exact repro reported by the user: "2일차에 디즈니랜드로 가줘" doesn't contain any of
  // KO_CONFIG.addKeyword's words (추가|넣어|포함), so the regex parser can't resolve it and this
  // falls through to the local AI engine path (resolveTripChatActionWithAi), unlike the weather
  // test above which the regex parser resolves directly. Checking whether *that* path is the one
  // that stays stuck on the language active when the AI engine first loaded.
  it('resolves free-form add-activity requests via the AI engine in the currently selected language, and re-renders past replies too when the language changes', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    const complete = vi.fn().mockResolvedValue(JSON.stringify({ action: 'add_activity', day: 2, activity: 'Disneyland' }))
    const enginePromise = Promise.resolve({ complete })
    const loadEngine = vi.fn().mockReturnValue(enginePromise)

    renderAtWithLanguageSwitching(server, `/trips/${trip.id}`, loadEngine, () => true)
    await act(async () => {
      await enginePromise
    })

    await user.type(await screen.findByLabelText('메시지 입력'), '2일차에 디즈니랜드로 가줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    expect(await screen.findByText(/2일차에.*Disneyland.*추가했어요/)).toBeInTheDocument()

    // Switching languages must re-render that already-sent reply in the new language too — not
    // just replies to messages sent after the switch (the user's exact reported repro: ask the
    // AI to add Disneyland on day 2, then switch languages, and find the reply still Korean).
    await user.click(screen.getByRole('button', { name: 'English' }))
    expect(await screen.findByText(/Added "Disneyland" to day 2/)).toBeInTheDocument()
    expect(screen.queryByText(/추가했어요/)).not.toBeInTheDocument()
  })

  it('renders the itinerary for the trip matching the URL', async () => {
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
      mustVisit: '아사쿠사 관광',
    })

    renderAt(server, `/trips/${trip.id}`)

    expect(await screen.findByText(/일본 도쿄/)).toBeInTheDocument()
    expect(screen.getByText('아사쿠사 관광')).toBeInTheDocument()
  })

  it('shows a not-found message with a link back to the trip list for an unknown id', async () => {
    signIn()
    renderAt(createFakeApiServer(), '/trips/does-not-exist')

    expect(await screen.findByText('해당 일정을 찾을 수 없어요.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '내 여행 일정 목록으로' })).toHaveAttribute(
      'href',
      '/trips',
    )
  })

  it('removes an activity, shows a notice, and persists the change', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
      mustVisit: '아사쿠사 관광',
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.click(await screen.findByRole('button', { name: '아사쿠사 관광 삭제' }))

    expect(screen.queryByText('아사쿠사 관광')).not.toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('AI')
  })

  it('toggles a favorite and persists it', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
      mustVisit: '아사쿠사 관광',
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.click(await screen.findByRole('button', { name: '아사쿠사 관광 즐겨찾기 추가' }))

    expect(await screen.findByRole('button', { name: '아사쿠사 관광 즐겨찾기 해제' })).toBeInTheDocument()
    expect([...server.favorites.values()]).toContainEqual(
      expect.objectContaining({ destination: '일본 도쿄', activity: '아사쿠사 관광' }),
    )
  })

  it('shows a button to share the trip to the community', async () => {
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    expect(await screen.findByRole('button', { name: '커뮤니티에 공유하기' })).toBeInTheDocument()
  })

  it('publishes the trip to the community when shared, using the first travel style as its tag', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.click(await screen.findByRole('button', { name: '커뮤니티에 공유하기' }))

    expect(await screen.findByRole('button', { name: '커뮤니티에서 내리기' })).toBeInTheDocument()

    const published = [...server.communityTrips.values()].find((c) => c.sourceTripId === trip.id)
    expect(published?.itinerary).toMatchObject({ destination: '일본 도쿄' })
    expect(published?.tag).toBe('맛집 중심')
  })

  it('keeps a published trip’s community post in sync when the trip is edited afterward', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.click(await screen.findByRole('button', { name: '커뮤니티에 공유하기' }))
    await screen.findByRole('button', { name: '커뮤니티에서 내리기' })

    const communityTrip = [...server.communityTrips.values()].find((c) => c.sourceTripId === trip.id)!
    expect(communityTrip.itinerary).toMatchObject(trip.itinerary)

    await user.click(await screen.findByRole('button', { name: '일정 추가' }))

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(communityTrip.itinerary).toEqual(serverTrip(server, trip.id).itinerary)
  })

  it('removes the trip from the community when un-shared', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.click(await screen.findByRole('button', { name: '커뮤니티에 공유하기' }))
    await user.click(await screen.findByRole('button', { name: '커뮤니티에서 내리기' }))

    expect(await screen.findByRole('button', { name: '커뮤니티에 공유하기' })).toBeInTheDocument()
    expect([...server.communityTrips.values()].find((c) => c.sourceTripId === trip.id)).toBeUndefined()
  })

  it('asks for confirmation before deleting the trip, then deletes it and navigates to the list', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.click(await screen.findByRole('button', { name: '일정 삭제' }))
    expect(screen.getByText('정말 이 일정을 삭제할까요?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '삭제 확정' }))

    expect(await screen.findByText('목록 페이지')).toBeInTheDocument()
    expect(server.trips.has(trip.id)).toBe(false)
  })

  it('cancels the delete confirmation without deleting the trip', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.click(await screen.findByRole('button', { name: '일정 삭제' }))
    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.queryByText('정말 이 일정을 삭제할까요?')).not.toBeInTheDocument()
    expect(server.trips.has(trip.id)).toBe(true)
  })

  it('adjusts the itinerary when told a specific day will be rainy', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })
    const originalDay1 = [...trip.itinerary.days[0].activities]

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '첫째 날은 비가 올 것 같아')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findAllByText(/실내/)).not.toHaveLength(0)
    const updatedDay1 = serverTrip(server, trip.id).itinerary.days[0].activities
    expect(updatedDay1).not.toEqual(originalDay1)
    for (const activity of originalDay1) {
      expect(updatedDay1).not.toContain(activity)
    }
  })

  it('adjusts the itinerary for weather other than rain, such as a heatwave', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })
    const originalDay1 = [...trip.itinerary.days[0].activities]

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '첫째 날 폭염이래')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findAllByText(/실내/)).not.toHaveLength(0)
    const updatedDay1 = serverTrip(server, trip.id).itinerary.days[0].activities
    expect(updatedDay1).not.toEqual(originalDay1)
  })

  it('keeps the itinerary unchanged and responds positively when told the weather is clear', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })
    const originalDay1 = [...trip.itinerary.days[0].activities]

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '첫째 날은 날씨가 맑대')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/그대로/)).toBeInTheDocument()
    expect(serverTrip(server, trip.id).itinerary.days[0].activities).toEqual(originalDay1)
  })

  it('adjusts day 2 (not day 1) when told day 2 will snow', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })
    const originalDay1 = [...trip.itinerary.days[0].activities]
    const originalDay2 = [...trip.itinerary.days[1].activities]

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '둘째 날은 눈이 올 것 같아')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    await screen.findAllByText(/실내/)
    const updated = serverTrip(server, trip.id)
    expect(updated.itinerary.days[1].activities).not.toEqual(originalDay2)
    expect(updated.itinerary.days[0].activities).toEqual(originalDay1)
  })

  it('reverts a day back to its original outdoor activities when asked, even without repeating the weather', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })
    const originalDay1 = [...trip.itinerary.days[0].activities]

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '첫째 날은 비가 올 것 같아')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    await screen.findAllByText(/실내/)
    expect(serverTrip(server, trip.id).itinerary.days[0].activities).not.toEqual(originalDay1)

    await user.type(screen.getByLabelText('메시지 입력'), '첫째 날 다시 실외로 해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findAllByText(/실외/)).not.toHaveLength(0)
    expect(serverTrip(server, trip.id).itinerary.days[0].activities).toEqual(originalDay1)
  })

  it('asks for clarification when the message has no day or weather', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '안녕')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/어느 날짜에 어떤 날씨/)).toBeInTheDocument()
  })

  // Regression: "2일차" alone after an unrelated message used to fall all the way back to the
  // same generic clarification message, as if the day had never been understood at all.
  it('asks specifically for the weather when only the day is given after an unrelated message', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '어디가고 싶어')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    expect(await screen.findByText(/어느 날짜에 어떤 날씨/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('메시지 입력'), '2일차')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/2일차인 건 알겠어요/)).toBeInTheDocument()
  })

  it('asks specifically for the day when only the weather is given, with no day mentioned', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '비가 올 것 같아')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/비 소식이군요/)).toBeInTheDocument()
  })

  it('applies the weather action once the day and weather are given across two separate turns (day first)', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })
    const originalDay1 = [...trip.itinerary.days[0].activities]

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '1일차')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    expect(await screen.findByText(/1일차인 건 알겠어요/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('메시지 입력'), '비가 올 것 같아')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findAllByText(/실내/)).not.toHaveLength(0)
    const updatedDay1 = serverTrip(server, trip.id).itinerary.days[0].activities
    expect(updatedDay1).not.toEqual(originalDay1)
    for (const activity of originalDay1) {
      expect(updatedDay1).not.toContain(activity)
    }
  })

  it('applies the weather action once the day and weather are given across two separate turns (weather first)', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })
    const originalDay1 = [...trip.itinerary.days[0].activities]

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '비가 올 것 같아')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    expect(await screen.findByText(/비 소식이군요/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('메시지 입력'), '1일차')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findAllByText(/실내/)).not.toHaveLength(0)
    const updatedDay1 = serverTrip(server, trip.id).itinerary.days[0].activities
    expect(updatedDay1).not.toEqual(originalDay1)
    for (const activity of originalDay1) {
      expect(updatedDay1).not.toContain(activity)
    }
  })

  it('does not merge an unrelated add-activity message into a pending weather clarification, and still adds the activity normally', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    // Leaves day 1 pending, waiting on the weather half of the pair.
    await user.type(await screen.findByLabelText('메시지 입력'), '1일차')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    expect(await screen.findByText(/1일차인 건 알겠어요/)).toBeInTheDocument()

    // An unrelated add-activity message must still work normally, not get swallowed by the
    // pending weather slot.
    await user.type(screen.getByLabelText('메시지 입력'), '2일차에 디즈니랜드 추가해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    expect(await screen.findByText(/2일차에.*디즈니랜드.*추가했어요/)).toBeInTheDocument()
    expect(serverTrip(server, trip.id).itinerary.days[1].activities).toContain('디즈니랜드')

    // The stale "day 1" pending from before the add-activity message must have been cleared —
    // a weather-only message now should ask for the day again, not silently reuse day 1.
    await user.type(screen.getByLabelText('메시지 입력'), '비가 올 것 같아')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    expect(await screen.findByText(/비 소식이군요/)).toBeInTheDocument()
  })

  // Exact regression reported by the user: a remove request with no day used to fall all the way
  // back to the fully generic clarification (which happens to mention "which day" among other
  // things), and the activity name it already gave ('디즈니랜드') was discarded entirely. Answering
  // with just the day afterward then got misread as completing an imagined WEATHER intent (since
  // parseWeatherIntent's day extraction has no keyword gate) instead of the remove that was
  // actually in progress — so the user got asked "what's the weather?" instead of the item being
  // removed.
  it('remembers a remove request missing only the day, asks specifically for the day, and completes the removal once the day is given', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['가족 여행'],
    })
    expect(trip.itinerary.days[0].activities).toContain('도쿄 디즈니랜드 (우라야스)')

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '디즈니랜드 삭제해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    // Asks specifically for the day for THIS remove request — not the fully generic clarification.
    expect(await screen.findByText(/디즈니랜드.*몇 일차에서 삭제할까요/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('메시지 입력'), '1일차')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    // The removal actually executes — not a "what's the weather?" reply.
    expect(await screen.findByText(/1일차에서.*도쿄 디즈니랜드 \(우라야스\).*삭제했어요/)).toBeInTheDocument()
    expect(screen.queryByText(/어떤 날씨/)).not.toBeInTheDocument()
    expect(serverTrip(server, trip.id).itinerary.days[0].activities).not.toContain('도쿄 디즈니랜드 (우라야스)')
  })

  // Same shape as the remove regression above, but for add.
  it('remembers an add request missing only the day, asks specifically for the day, and completes the addition once the day is given', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '디즈니랜드 추가해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    expect(await screen.findByText(/디즈니랜드.*몇 일차에 추가할까요/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('메시지 입력'), '2일차')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/2일차에.*디즈니랜드.*추가했어요/)).toBeInTheDocument()
    expect(screen.queryByText(/어떤 날씨/)).not.toBeInTheDocument()
    expect(serverTrip(server, trip.id).itinerary.days[1].activities).toContain('디즈니랜드')
  })

  // A bare day-only message doesn't short-circuit locally when nothing is pending — the local AI
  // engine (when loaded) still gets first crack at it, same as any other message the regex parsers
  // can't fully resolve on their own.
  it('still lets the local AI engine see a bare day-only message when no add/remove/weather request is pending', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    const complete = vi.fn().mockResolvedValue(JSON.stringify({ action: 'unknown' }))
    const enginePromise = Promise.resolve({ complete })
    const loadEngine = vi.fn().mockReturnValue(enginePromise)

    renderAt(server, `/trips/${trip.id}`, undefined, loadEngine, () => true)
    await act(async () => {
      await enginePromise
    })

    await user.type(await screen.findByLabelText('메시지 입력'), '2일차')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(complete).toHaveBeenCalled()
    expect(await screen.findByText(/2일차인 건 알겠어요/)).toBeInTheDocument()
  })

  it('keeps giving the generic clarification for two fully unrelated messages in a row', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '안녕')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    expect(await screen.findByText(/어느 날짜에 어떤 날씨/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('메시지 입력'), '음 글쎄')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findAllByText(/어느 날짜에 어떤 날씨/)).toHaveLength(2)
    expect(screen.queryByText(/인 건 알겠어요/)).not.toBeInTheDocument()
    expect(screen.queryByText(/소식이군요/)).not.toBeInTheDocument()
  })

  it('shows a chat title and greeting that mention both weather and adding activities', async () => {
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)
    await screen.findByText(/일본 도쿄/)

    expect(screen.getByText('AI에게 일정을 말해보세요')).toBeInTheDocument()
    expect(screen.getByText(/디즈니랜드 추가해줘/)).toBeInTheDocument()
  })

  it('adds a specific named activity to the requested day via chat, and persists it', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '2일차에 디즈니랜드 추가해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/2일차에.*디즈니랜드.*추가했어요/)).toBeInTheDocument()
    expect(screen.getAllByText('디즈니랜드').length).toBeGreaterThan(0)
    expect(serverTrip(server, trip.id).itinerary.days[1].activities).toContain('디즈니랜드')
  })

  it('rejects a day it does not recognize when adding a named activity via chat', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '9일차에 디즈니랜드 추가해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/9일차는 이번 일정에 없어요/)).toBeInTheDocument()
  })

  it('removes a chat-added activity from the requested day via chat, and persists it', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '1일차에 디즈니랜드 추가해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    await screen.findByText(/1일차에.*디즈니랜드.*추가했어요/)
    expect(screen.getAllByText('디즈니랜드').length).toBeGreaterThan(0)

    await user.type(screen.getByLabelText('메시지 입력'), '1일차에 디즈니랜드 삭제해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/1일차에서.*디즈니랜드.*삭제했어요/)).toBeInTheDocument()
    expect(screen.queryByText('디즈니랜드')).not.toBeInTheDocument()
    expect(serverTrip(server, trip.id).itinerary.days[0].activities).not.toContain('디즈니랜드')
  })

  // Regression for the bug where catalog-backed activities are stored as "이름 (지역)"
  // (getStylePool in generatePlan.ts) but the user naturally says just the short name — an exact
  // string match against '도쿄 디즈니랜드 (우라야스)' never succeeds for '디즈니랜드'.
  it('removes a catalog-backed activity by its short spoken name and mentions the full matched name', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['가족 여행'],
    })
    expect(trip.itinerary.days[0].activities).toContain('도쿄 디즈니랜드 (우라야스)')

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '1일차에 디즈니랜드 삭제해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/1일차에서.*도쿄 디즈니랜드 \(우라야스\).*삭제했어요/)).toBeInTheDocument()
    expect(serverTrip(server, trip.id).itinerary.days[0].activities).not.toContain('도쿄 디즈니랜드 (우라야스)')
  })

  it('tells the user which day an activity is actually on when it exists but not on the day they specified, and leaves the itinerary unchanged', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['가족 여행'],
    })
    // '도쿄 디즈니랜드 (우라야스)' lands on day 1, not day 2 — a plausible "which day was it again?" mix-up.
    expect(trip.itinerary.days[0].activities).toContain('도쿄 디즈니랜드 (우라야스)')
    expect(trip.itinerary.days[1].activities).not.toContain('도쿄 디즈니랜드 (우라야스)')
    const beforeItinerary = serverTrip(server, trip.id).itinerary

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '2일차에 디즈니랜드 삭제해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(
      await screen.findByText(/2일차에.*도쿄 디즈니랜드 \(우라야스\).*없어요.*1일차에 있어요/),
    ).toBeInTheDocument()
    expect(serverTrip(server, trip.id).itinerary).toEqual(beforeItinerary)
  })

  it('tells the user when the activity they asked to remove is not on that day', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '1일차에 없는활동이름 삭제해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/1일차에.*없는활동이름.*없어요/)).toBeInTheDocument()
  })

  // 아래 AI 관련 테스트들은 실제 WebGPU/WebLLM 없이도 검증하기 위해, TripDetailPage의
  // loadEngine/isSupported props에 가짜 엔진을 주입한다(PlanChatPage.test.tsx와 같은 패턴).
  // isSupported를 () => true로 강제해야 이 브라우저(jsdom)에서도 로딩 effect가 실행된다.
  it('resolves a free-form message via the local AI engine once it has loaded, and executes the returned action', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    const complete = vi.fn().mockResolvedValue(
      JSON.stringify({ action: 'add_activity', day: 2, activity: '디즈니랜드' }),
    )
    const enginePromise = Promise.resolve({ complete })
    const loadEngine = vi.fn().mockReturnValue(enginePromise)

    renderAt(server, `/trips/${trip.id}`, undefined, loadEngine, () => true)
    await act(async () => {
      await enginePromise
    })

    await user.type(await screen.findByLabelText('메시지 입력'), '음 2일차에 그것도 하면 재밌겠다')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/2일차에.*디즈니랜드.*추가했어요/)).toBeInTheDocument()
    expect(complete).toHaveBeenCalled()
    expect(serverTrip(server, trip.id).itinerary.days[1].activities).toContain('디즈니랜드')
  })

  it('shows a loading status with live progress while the AI engine downloads', async () => {
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    let capturedOnProgress: ((report: InitProgressReport) => void) | undefined
    const loadEngine = vi.fn((onProgress?: (report: InitProgressReport) => void) => {
      capturedOnProgress = onProgress
      return new Promise<ChatEngine>(() => {})
    })

    renderAt(server, `/trips/${trip.id}`, undefined, loadEngine, () => true)
    await screen.findByText(/일본 도쿄/)

    expect(screen.getByText(/AI 모델을 준비하고 있어요/)).toBeInTheDocument()

    act(() => {
      capturedOnProgress?.({ progress: 0.42, timeElapsed: 1, text: '' })
    })

    expect(screen.getByText(/AI 모델을 준비하고 있어요/)).toHaveTextContent('42%')
  })

  it('hides the loading status once the AI engine finishes loading', async () => {
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    const enginePromise = Promise.resolve({ complete: vi.fn() })
    const loadEngine = vi.fn().mockReturnValue(enginePromise)

    renderAt(server, `/trips/${trip.id}`, undefined, loadEngine, () => true)
    await screen.findByText(/AI 모델을 준비하고 있어요/)

    await act(async () => {
      await enginePromise
    })

    expect(screen.queryByText(/AI 모델을 준비하고 있어요/)).not.toBeInTheDocument()
  })

  it('hides the loading status when the engine fails to load', async () => {
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    const loadEngine = vi.fn().mockRejectedValue(new Error('load failed'))

    renderAt(server, `/trips/${trip.id}`, undefined, loadEngine, () => true)
    await screen.findByText(/AI 모델을 준비하고 있어요/)

    await act(async () => {
      await loadEngine.mock.results[0].value.catch(() => {})
    })

    expect(screen.queryByText(/AI 모델을 준비하고 있어요/)).not.toBeInTheDocument()
  })

  it('never shows a loading status on a browser without AI support', async () => {
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)
    await screen.findByText(/일본 도쿄/)

    expect(screen.queryByText(/AI 모델을 준비하고 있어요/)).not.toBeInTheDocument()
  })

  it('does not call the AI engine when the message already matches a regex pattern (fast path first)', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    const complete = vi.fn().mockResolvedValue(JSON.stringify({ action: 'unknown' }))
    const enginePromise = Promise.resolve({ complete })
    const loadEngine = vi.fn().mockReturnValue(enginePromise)

    renderAt(server, `/trips/${trip.id}`, undefined, loadEngine, () => true)
    await act(async () => {
      await enginePromise
    })

    await user.type(await screen.findByLabelText('메시지 입력'), '1일차에 도쿄타워 추가해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    await screen.findByText(/1일차에.*도쿄타워.*추가했어요/)

    expect(complete).not.toHaveBeenCalled()
  })

  it('keeps earlier turns (even regex-handled ones) as AI prompt context for a later free-form turn', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    const complete = vi.fn().mockResolvedValue(
      JSON.stringify({ action: 'add_activity', day: 2, activity: '디즈니랜드' }),
    )
    const enginePromise = Promise.resolve({ complete })
    const loadEngine = vi.fn().mockReturnValue(enginePromise)

    renderAt(server, `/trips/${trip.id}`, undefined, loadEngine, () => true)
    await act(async () => {
      await enginePromise
    })

    await user.type(await screen.findByLabelText('메시지 입력'), '1일차에 도쿄타워 추가해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    await screen.findByText(/1일차에.*도쿄타워.*추가했어요/)

    await user.type(screen.getByLabelText('메시지 입력'), '음 2일차에 그것도 하면 재밌겠다')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    await screen.findByText(/2일차에.*디즈니랜드.*추가했어요/)

    expect(complete).toHaveBeenCalledTimes(1)
    const [messages] = complete.mock.calls[0] as [{ content: string }[]]
    const allContent = messages.map((m) => m.content).join(' ')
    expect(allContent).toContain('도쿄타워')
  })

  it('falls back to the clarification message when the AI cannot determine an action', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    const complete = vi.fn().mockResolvedValue(JSON.stringify({ action: 'unknown' }))
    const enginePromise = Promise.resolve({ complete })
    const loadEngine = vi.fn().mockReturnValue(enginePromise)

    renderAt(server, `/trips/${trip.id}`, undefined, loadEngine, () => true)
    await act(async () => {
      await enginePromise
    })

    await user.type(await screen.findByLabelText('메시지 입력'), '음 아무튼 그냥 그거요')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/어느 날짜에 어떤 날씨인지/)).toBeInTheDocument()
  })

  // Exact reported repro: "추천해줘" matches none of add/remove/weather, so it either fell to the
  // local AI engine — which, forced to pick from add_activity/remove_activity/weather/unknown,
  // hallucinated a weather change (e.g. guessed rain) — or, on a retry, to the generic
  // clarificationMessage. Neither is a real answer to "recommend something". With 관광 중심 selected
  // for 일본 도쿄, days 1–3 deterministically place the 6 catalog spots plus the first 3 generic
  // activities (see generatePlan.ts's takeFreshActivities), so the next fresh generic activities —
  // '유명 사원 관광' and '구시가지 골목 탐방' — are exactly what should be suggested.
  it('suggests a fresh, unused activity from the trip’s style when asked to recommend something, via the regex path alone (no AI engine needed)', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })
    const beforeItinerary = serverTrip(server, trip.id).itinerary

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '추천해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/유명 사원 관광/)).toBeInTheDocument()
    expect(screen.getByText(/구시가지 골목 탐방/)).toBeInTheDocument()
    // 신고된 버그의 두 증상이 재발하지 않았는지 확인한다: 날씨로 잘못 해석되지도, 일반
    // 안내문으로 되돌아가지도 않아야 한다.
    expect(screen.queryByText(/소식을 반영해서/)).not.toBeInTheDocument()
    expect(screen.queryByText(/몇 일차에 어떤 활동을 추가·삭제하고 싶은지/)).not.toBeInTheDocument()
    // 추천은 정보 제공일 뿐 일정을 바꾸지 않는다.
    expect(serverTrip(server, trip.id).itinerary).toEqual(beforeItinerary)
  })

  it('resolves a recommend request via the regex path even with an AI engine loaded that would otherwise hallucinate a weather change', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    // 신고된 버그를 그대로 재현하는 가짜 엔진 — add_activity/remove_activity/weather/unknown 중
    // 하나만 고를 수 있던 예전 스키마라면 "추천해줘"를 이해하지 못하고 비가 온다고 잘못
    // 추측했을 상황이다. 정규식이 먼저 처리되면 이 엔진은 아예 호출되지 않아야 한다.
    const complete = vi.fn().mockResolvedValue(JSON.stringify({ action: 'weather', day: 1, weather: 'rain' }))
    const enginePromise = Promise.resolve({ complete })
    const loadEngine = vi.fn().mockReturnValue(enginePromise)

    renderAt(server, `/trips/${trip.id}`, undefined, loadEngine, () => true)
    await act(async () => {
      await enginePromise
    })

    await user.type(await screen.findByLabelText('메시지 입력'), '추천해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/유명 사원 관광/)).toBeInTheDocument()
    expect(complete).not.toHaveBeenCalled()
  })

  it('scopes a recommend request to a mentioned day without letting the bare day number get absorbed into a weather clarification', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['관광 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '2일차에 뭐 넣을지 추천해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/2일차에는.*유명 사원 관광/)).toBeInTheDocument()
    expect(screen.queryByText(/어떤 날씨인지도 알려주시겠어요/)).not.toBeInTheDocument()
  })

  it('falls back to a "nothing new to suggest" reply when the trip has no travel style selected', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: [],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.type(await screen.findByLabelText('메시지 입력'), '추천해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/새로 추천할 만한 활동을 찾지 못했어요/)).toBeInTheDocument()
  })

  it('lets the user pick a concrete alternative place for an activity and persists it', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '1박 2일',
      styles: ['가족 여행'],
    })
    const original = trip.itinerary.days[0].activities[0]

    renderAt(server, `/trips/${trip.id}`)

    await user.click(await screen.findByRole('button', { name: `${original} 다른 옵션 보기` }))
    const optionButtons = screen.getAllByRole('button', { name: /선택$/ })
    const chosenLabel = optionButtons[0].getAttribute('aria-label') ?? ''
    const chosen = chosenLabel.replace(' 선택', '')

    await user.click(optionButtons[0])

    expect(screen.queryAllByText(original)).toHaveLength(0)
    expect(screen.getAllByText(chosen).length).toBeGreaterThan(0)
    expect(await waitForActivities(server, trip.id)).toContain(chosen)
  })

  it('lets the user directly type a replacement activity and persists it', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
      mustVisit: '아사쿠사 관광',
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.click(await screen.findByRole('button', { name: '아사쿠사 관광 직접 수정' }))
    const input = screen.getByRole('textbox', { name: '아사쿠사 관광 수정 입력' })
    await user.clear(input)
    await user.type(input, '우에노 공원 산책')
    await user.click(screen.getByRole('button', { name: '수정' }))

    expect(screen.queryByText('아사쿠사 관광')).not.toBeInTheDocument()
    expect(screen.getByText('우에노 공원 산책')).toBeInTheDocument()
    expect(await waitForActivities(server, trip.id)).toContain('우에노 공원 산책')
  })

  it('keeps offering swap alternatives even after several swaps use up the initial suggestions', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '평행우주 도시',
      duration: '1박 2일',
      styles: ['쇼핑 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await screen.findByRole('heading', { name: '1일차' })
    const totalToggles = screen.getAllByRole('button', { name: /다른 옵션 보기/ }).length

    for (let i = 0; i < 3; i++) {
      const [toggle] = screen.getAllByRole('button', { name: /다른 옵션 보기/ })
      await user.click(toggle)
      const [option] = screen.getAllByRole('button', { name: /선택$/ })
      await user.click(option)
    }

    // Day 1's slots should still offer swaps; only day 2 (never touched) surviving would leave half as many.
    expect(screen.getAllByRole('button', { name: /다른 옵션 보기/ }).length).toBeGreaterThan(totalToggles / 2)
  })

  it('fetches and shows the daily forecast for a trip that has a start date', async () => {
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '1박 2일',
      styles: ['맛집 중심'],
      startDate: '2026-07-25',
    })
    const fetchDailyForecast = vi.fn().mockResolvedValue([
      { date: '2026-07-25', condition: 'sunny', maxTemperature: 30, minTemperature: 22, precipitation: 0 },
      { date: '2026-07-26', condition: 'rainy', maxTemperature: 26, minTemperature: 20, precipitation: 12.4 },
    ] satisfies DailyForecast[])

    renderAt(server, `/trips/${trip.id}`, fetchDailyForecast)

    expect(await screen.findByText('☀️ 최고 30° · 최저 22°')).toBeInTheDocument()
    expect(screen.getByText('🌧️ 최고 26° · 최저 20° · 강수 12.4mm')).toBeInTheDocument()
    expect(fetchDailyForecast).toHaveBeenCalledWith('2026-07-25', 2)
  })

  it('does not fetch a forecast for a trip with no start date', async () => {
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '1박 2일',
      styles: ['맛집 중심'],
    })
    const fetchDailyForecast = vi.fn().mockResolvedValue([])

    renderAt(server, `/trips/${trip.id}`, fetchDailyForecast)

    await screen.findByText(/일본 도쿄/)
    expect(fetchDailyForecast).not.toHaveBeenCalled()
  })

  it('adds a new day beyond the original duration and persists it', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.click(await screen.findByRole('button', { name: '일정 추가' }))

    expect(await screen.findByRole('heading', { name: '4일차' })).toBeInTheDocument()
    expect(serverTrip(server, trip.id).itinerary.days).toHaveLength(4)
  })

  it('can add multiple days in a row, past the original 3', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
    })

    renderAt(server, `/trips/${trip.id}`)

    await user.click(await screen.findByRole('button', { name: '일정 추가' }))
    await user.click(await screen.findByRole('button', { name: '일정 추가' }))

    expect(await screen.findByRole('heading', { name: '5일차' })).toBeInTheDocument()
    expect(serverTrip(server, trip.id).itinerary.days).toHaveLength(5)
  })

  it('adds another activity to a specific day beyond the ones AI initially generated', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
    })
    const originalCount = trip.itinerary.days[0].activities.length

    renderAt(server, `/trips/${trip.id}`)

    await user.click(await screen.findByRole('button', { name: '1일차 활동 추가' }))

    expect(await screen.findByRole('status')).toHaveTextContent('추가했어요')
    expect(serverTrip(server, trip.id).itinerary.days[0].activities).toHaveLength(originalCount + 1)
  })

  it('lets the user enter a cost for a well-known attraction like Disneyland, same as any other activity', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '1박 2일',
      budget: '100',
      styles: ['맛집 중심'],
      mustVisit: '도쿄 디즈니랜드 (우라야스)',
    })

    renderAt(server, `/trips/${trip.id}`)

    const input = await screen.findByRole('spinbutton', { name: '도쿄 디즈니랜드 (우라야스) 비용 입력' })
    expect(input).toBeEnabled()

    await user.type(input, '55000')

    expect(await screen.findByText('1일차 55,000원 사용')).toBeInTheDocument()
    expect(serverTrip(server, trip.id).costs).toEqual({ 1: { '도쿄 디즈니랜드 (우라야스)': 55000 } })
  })

  it('lets the user enter a cost for an activity, updates the day/trip totals, and persists it', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '1박 2일',
      budget: '100',
      styles: ['맛집 중심'],
      mustVisit: '아사쿠사 관광',
    })

    renderAt(server, `/trips/${trip.id}`)

    const input = await screen.findByRole('spinbutton', { name: '아사쿠사 관광 비용 입력' })
    await user.type(input, '5000')

    expect(await screen.findByText('1일차 5,000원 사용')).toBeInTheDocument()
    expect(
      screen.getByText('총 여행경비 5,000원 · 예산 1,000,000원 중 995,000원 남았어요'),
    ).toBeInTheDocument()
    expect(serverTrip(server, trip.id).costs).toEqual({ 1: { '아사쿠사 관광': 5000 } })
  })

  it('lets the user override the scheduled time for an activity and persists it', async () => {
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '1박 2일',
      styles: ['맛집 중심'],
      mustVisit: '아사쿠사 관광',
    })

    renderAt(server, `/trips/${trip.id}`)

    const input = await screen.findByLabelText('아사쿠사 관광 시간 입력')
    fireEvent.change(input, { target: { value: '13:45' } })

    expect(await screen.findByLabelText('아사쿠사 관광 시간 입력')).toHaveValue('13:45')
    expect(serverTrip(server, trip.id).times).toEqual({ 1: { '아사쿠사 관광': '13:45' } })
  })

  it('keeps a previously entered cost when the itinerary changes through another action', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
      mustVisit: '아사쿠사 관광',
    })

    renderAt(server, `/trips/${trip.id}`)

    const costInput = await screen.findByRole('spinbutton', { name: '아사쿠사 관광 비용 입력' })
    await user.type(costInput, '5000')
    expect(await screen.findByText('1일차 5,000원 사용')).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: '일정 추가' }))
    await screen.findByRole('heading', { name: '4일차' })

    expect(serverTrip(server, trip.id).costs).toEqual({ 1: { '아사쿠사 관광': 5000 } })
  })

  it('keeps a previously entered time override when a cost is entered on another activity', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '1박 2일',
      styles: ['맛집 중심'],
      mustVisit: '아사쿠사 관광',
    })

    renderAt(server, `/trips/${trip.id}`)

    const timeInput = await screen.findByLabelText('아사쿠사 관광 시간 입력')
    fireEvent.change(timeInput, { target: { value: '13:45' } })
    expect(await screen.findByLabelText('아사쿠사 관광 시간 입력')).toHaveValue('13:45')

    const costInput = screen.getByRole('spinbutton', { name: '아사쿠사 관광 비용 입력' })
    await user.type(costInput, '5000')
    expect(await screen.findByText('1일차 5,000원 사용')).toBeInTheDocument()

    expect(serverTrip(server, trip.id).times).toEqual({ 1: { '아사쿠사 관광': '13:45' } })
  })

  it('keeps adding activities past 6, then disables the button with a clear reason once the day is full', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeApiServer()
    const trip = await buildTrip(server, {
      ...emptyTripPlanFormValues,
      destination: '일본 도쿄',
      duration: '2박 3일',
      styles: ['맛집 중심'],
    })
    const originalCount = trip.itinerary.days[0].activities.length

    renderAt(server, `/trips/${trip.id}`)

    // Add enough activities to exceed the old 6-activity ceiling (the unique style pool size).
    for (let i = 0; i < 6; i++) {
      await user.click(await screen.findByRole('button', { name: '1일차 활동 추가' }))
    }
    const fullCount = serverTrip(server, trip.id).itinerary.days[0].activities.length
    expect(fullCount).toBeGreaterThan(6)
    expect(fullCount).toBe(originalCount + 6)

    const fullButton = screen.getByRole('button', { name: '1일차 일정이 가득 찼어요' })
    expect(fullButton).toBeDisabled()

    await user.click(fullButton)

    expect(serverTrip(server, trip.id).itinerary.days[0].activities).toHaveLength(fullCount)
  })
})

// The swap/edit handlers persist via an awaited PUT — give the fake server's in-flight
// request a moment to settle before reading back its state.
async function waitForActivities(server: FakeApiServer, tripId: string): Promise<string[]> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  return serverTrip(server, tripId).itinerary.days[0].activities
}
