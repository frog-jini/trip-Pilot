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

  // 회귀 테스트: 대화 도중 화면 언어를 영어로 바꿨다가 다시 한국어로 돌려도 일차/날씨 채팅이
  // 계속 영어로 답한다는 신고가 있었다 — 즉 답변 언어가 세션의 첫 메시지 때 언어에 "고정"됐다.
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

    // 이제 두 답변 모두 한국어로 보인다 — 새 답변과, 새로 고른 언어로 다시 렌더링된 이전(영어)
    // 답변 모두. 지난 대화도 다시 번역해 달라는 사용자의 명시적인 요청에 따른 것이다.
    expect(await screen.findByText(/1일차는 맑은 날씨라니 잘 됐네요/)).toBeInTheDocument()
    expect(screen.getByText(/2일차는 맑은 날씨라니 잘 됐네요/)).toBeInTheDocument()
    expect(screen.queryByText(/I’ll leave the plan as is/)).not.toBeInTheDocument()
  })

  // 사용자가 신고한 재현 그대로: "2일차에 디즈니랜드로 가줘"에는 KO_CONFIG.addKeyword의 단어
  // (추가|넣어|포함)가 하나도 없어서 정규식 파서가 처리하지 못하고, 로컬 AI 엔진 경로
  // (resolveTripChatActionWithAi)로 넘어간다. 정규식 파서가 바로 처리하는 위의 날씨 테스트와
  // 다른 점이다. *그* 경로가 AI 엔진이 처음 로드될 때의 언어에 고정되는지 확인한다.
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

    // 언어를 바꾸면 전환 이후에 보낸 메시지의 답변뿐 아니라 이미 보낸 답변도 새 언어로 다시
    // 렌더링돼야 한다 (사용자가 신고한 재현 그대로: AI에게 2일차에 디즈니랜드를 추가해 달라고 한
    // 뒤 언어를 바꿨더니 답변이 여전히 한국어였다).
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

  // 회귀 테스트: 관련 없는 메시지 뒤에 "2일차"만 보내면, 일차를 전혀 이해하지 못한 것처럼
  // 똑같은 일반 안내 메시지로 되돌아가곤 했다.
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

    // 1일차만 기억해 두고, 짝이 되는 날씨 정보를 기다린다.
    await user.type(await screen.findByLabelText('메시지 입력'), '1일차')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    expect(await screen.findByText(/1일차인 건 알겠어요/)).toBeInTheDocument()

    // 관련 없는 활동 추가 메시지는 기다리던 날씨 정보에 흡수되지 않고
    // 정상적으로 처리돼야 한다.
    await user.type(screen.getByLabelText('메시지 입력'), '2일차에 디즈니랜드 추가해줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    expect(await screen.findByText(/2일차에.*디즈니랜드.*추가했어요/)).toBeInTheDocument()
    expect(serverTrip(server, trip.id).itinerary.days[1].activities).toContain('디즈니랜드')

    // 활동 추가 메시지 전에 기억해 뒀던 오래된 "1일차"는 지워졌어야 한다 — 이제 날씨만 보내면
    // 1일차를 몰래 재사용하지 않고 일차를 다시 물어봐야 한다.
    await user.type(screen.getByLabelText('메시지 입력'), '비가 올 것 같아')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    expect(await screen.findByText(/비 소식이군요/)).toBeInTheDocument()
  })

  // 사용자가 신고한 회귀 그대로: 일차 없이 삭제를 요청하면 완전히 일반적인 안내 메시지(여러 내용
  // 중에 "어느 날"도 언급함)로 되돌아갔고, 이미 말한 활동명('디즈니랜드')은 통째로 버려졌다. 그 뒤
  // 일차만 답하면, 실제로 진행 중이던 삭제가 아니라 있지도 않은 날씨 요청을 완성하는 것으로 잘못
  // 해석됐다(parseWeatherIntent의 일차 추출에는 키워드 조건이 없기 때문). 그래서 활동이 삭제되는
  // 대신 "날씨가 어떤가요?"라는 질문을 받았다.
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
    // 완전히 일반적인 안내가 아니라, *이* 삭제 요청에 필요한 일차를 콕 집어 물어본다.
    expect(await screen.findByText(/디즈니랜드.*몇 일차에서 삭제할까요/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('메시지 입력'), '1일차')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    // "날씨가 어떤가요?" 답변이 아니라 실제로 삭제가 실행된다.
    expect(await screen.findByText(/1일차에서.*도쿄 디즈니랜드 \(우라야스\).*삭제했어요/)).toBeInTheDocument()
    expect(screen.queryByText(/어떤 날씨/)).not.toBeInTheDocument()
    expect(serverTrip(server, trip.id).itinerary.days[0].activities).not.toContain('도쿄 디즈니랜드 (우라야스)')
  })

  // 위의 삭제 회귀 테스트와 같은 형태지만, 추가 요청에 대한 것이다.
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

  // 기다리는 요청이 없을 때는 일차만 있는 메시지를 로컬에서 바로 처리하지 않는다 — 정규식
  // 파서만으로 완전히 처리할 수 없는 다른 메시지와 마찬가지로, (로드돼 있다면) 로컬 AI 엔진이
  // 먼저 처리해 볼 기회를 얻는다.
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

  // 회귀 테스트: 카탈로그 기반 활동은 "이름 (지역)" 형태로 저장되는데(generatePlan.ts의
  // getStylePool), 사용자는 자연스럽게 짧은 이름만 말한다 — 그래서 '디즈니랜드'를 '도쿄 디즈니랜드
  // (우라야스)'와 정확히 문자열 비교하면 절대 일치하지 않던 버그.
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

  // 신고된 재현 그대로: "추천해줘"는 추가/삭제/날씨 어디에도 해당하지 않아서, 로컬 AI 엔진으로
  // 넘어가거나(add_activity/remove_activity/weather/unknown 중 하나를 골라야 해서 있지도 않은
  // 날씨 변경을 지어냄, 예: 비가 온다고 추측) 다시 시도하면 일반 안내 메시지(clarificationMessage)로
  // 넘어갔다. 둘 다 "뭔가 추천해줘"에 대한 진짜 답이 아니다. 일본 도쿄에 관광 중심을 고르면
  // 1~3일차에 카탈로그 장소 6개와 일반 활동 앞의 3개가 항상 같은 순서로 배치되므로
  // (generatePlan.ts의 takeFreshActivities 참고), 그다음 새 일반 활동인 '유명 사원 관광'과
  // '구시가지 골목 탐방'이 정확히 추천돼야 한다.
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

    // 1일차 활동에도 여전히 교체 버튼이 있어야 한다; 손대지 않은 2일차만 남아 있다면 버튼 수가 절반이 된다.
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

    // 예전 상한이던 활동 6개(스타일별 고유 항목 수)를 넘을 만큼 활동을 추가한다.
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

// 교체/수정 핸들러는 await한 PUT 요청으로 저장한다 — 가짜 서버의 상태를 다시 읽기 전에
// 진행 중인 요청이 끝날 시간을 잠깐 준다.
async function waitForActivities(server: FakeApiServer, tripId: string): Promise<string[]> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  return serverTrip(server, tripId).itinerary.days[0].activities
}
