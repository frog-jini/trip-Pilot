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

describe('TripDetailPage', () => {
  afterEach(() => {
    localStorage.clear()
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
