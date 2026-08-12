// /plan/chat 화면 테스트. loadEngine/isSupported를 주입해 실제 WebGPU 없이도 "AI 로딩 중"
// 표시, AI 보조 파싱 성공, 로딩 실패 시 규칙 기반 파서로의 폴백까지 확인한다
// (TripDetailPage.test.tsx의 AI 관련 테스트와 같은 주입 패턴).
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PlanChatPage } from './PlanChatPage'
import { AuthProvider } from '../context/AuthContext'
import { writeStoredToken, writeStoredUser } from '../lib/authStorage'
import { createFakeTripsServer, type FakeTripsServer } from '../test/fakeTripsServer'
import type { ChatEngine } from '../lib/aiEngine'
import type { InitProgressReport } from '@mlc-ai/web-llm'

function signIn(id = '1', email = 'user@example.com') {
  writeStoredUser({ id, email })
  writeStoredToken(id)
}

function renderPlanChatPage(
  server: FakeTripsServer,
  loadEngine?: (onProgress?: (report: InitProgressReport) => void) => Promise<ChatEngine>,
  isSupported?: () => boolean,
) {
  return render(
    <MemoryRouter initialEntries={['/plan/chat']}>
      <AuthProvider>
        <Routes>
          <Route
            path="/plan/chat"
            element={
              <PlanChatPage loadEngine={loadEngine} isSupported={isSupported} fetchImpl={server.fetchImpl} />
            }
          />
          <Route path="/trips/:tripId" element={<div>결과 페이지</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('PlanChatPage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('renders the heading and an AI chat with no itinerary table shown up front', () => {
    signIn()
    renderPlanChatPage(createFakeTripsServer())

    expect(screen.getByRole('heading', { level: 1, name: '대화로 여행 일정 완성하기' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'AI에게 여행 이야기를 들려주세요' })).toBeInTheDocument()
    expect(screen.getByRole('log', { name: 'AI 채팅' })).toBeInTheDocument()
    expect(screen.queryByText('AI 생성 일정')).not.toBeInTheDocument()
    expect(screen.getByLabelText('메시지 입력')).toHaveAttribute(
      'placeholder',
      '예: 도쿄 2박3일로 쇼핑 위주 일정 짜줘, 예산은 100만원',
    )
  })

  it('asks a follow-up question for whatever is still missing after a partial message', async () => {
    const user = userEvent.setup()
    signIn()
    renderPlanChatPage(createFakeTripsServer())

    await user.type(screen.getByLabelText('메시지 입력'), '도쿄 2박3일로 쇼핑 위주 일정 짜줘, 예산은 100만원')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/몇 명/)).toBeInTheDocument()
  })

  it('builds up the itinerary across multiple messages and creates the trip once everything is known', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeTripsServer()
    renderPlanChatPage(server)

    await user.type(screen.getByLabelText('메시지 입력'), '도쿄 2박3일로 쇼핑 위주 일정 짜줘, 예산은 100만원')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    await screen.findByText(/몇 명/)

    await user.type(screen.getByLabelText('메시지 입력'), '2명이요')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText('결과 페이지')).toBeInTheDocument()

    const trips = [...server.trips.values()]
    expect(trips).toHaveLength(1)
    const itinerary = trips[0].itinerary as {
      destination: string
      duration: string
      travelers: number
      budget: number
    }
    expect(itinerary.destination).toBe('일본 도쿄')
    expect(itinerary.duration).toBe('2박 3일')
    expect(itinerary.travelers).toBe(2)
    expect(itinerary.budget).toBe(100)
    expect((trips[0].formValues as { styles: string[] }).styles).toEqual(['쇼핑 중심'])
  })

  it('asks for the destination first when the first message has no recognizable info', async () => {
    const user = userEvent.setup()
    signIn()
    renderPlanChatPage(createFakeTripsServer())

    await user.type(screen.getByLabelText('메시지 입력'), '안녕')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/어디로/)).toBeInTheDocument()
  })

  it('uses the AI engine to parse a message once it has finished loading', async () => {
    const user = userEvent.setup()
    signIn()
    const server = createFakeTripsServer()
    const complete = vi.fn().mockResolvedValue(
      JSON.stringify({
        destination: '일본 도쿄',
        duration: '2박 3일',
        travelers: '2',
        budget: '100',
        styles: ['쇼핑 중심'],
      }),
    )
    const enginePromise = Promise.resolve({ complete })
    const loadEngine = vi.fn().mockReturnValue(enginePromise)

    renderPlanChatPage(server, loadEngine, () => true)
    await act(async () => {
      await enginePromise
    })

    await user.type(screen.getByLabelText('메시지 입력'), '아무 자유로운 한 문장이요')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText('결과 페이지')).toBeInTheDocument()
    expect(complete).toHaveBeenCalled()

    const trips = [...server.trips.values()]
    expect((trips[0].itinerary as { destination: string }).destination).toBe('일본 도쿄')
  })

  it('falls back to rule-based parsing when the engine fails to load', async () => {
    const user = userEvent.setup()
    signIn()
    const loadEngine = vi.fn().mockRejectedValue(new Error('WebGPU not supported'))

    renderPlanChatPage(createFakeTripsServer(), loadEngine, () => true)
    await act(async () => {
      await loadEngine.mock.results[0].value.catch(() => {})
    })

    await user.type(screen.getByLabelText('메시지 입력'), '도쿄로 가고 싶어')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByText(/몇 명/)).toBeInTheDocument()
  })

  it('shows a loading status with live progress while the AI engine downloads', () => {
    signIn()
    let capturedOnProgress: ((report: InitProgressReport) => void) | undefined
    const loadEngine = vi.fn((onProgress?: (report: InitProgressReport) => void) => {
      capturedOnProgress = onProgress
      return new Promise<ChatEngine>(() => {})
    })

    renderPlanChatPage(createFakeTripsServer(), loadEngine, () => true)

    expect(screen.getByRole('status')).toHaveTextContent('AI 모델을 준비하고 있어요')

    act(() => {
      capturedOnProgress?.({ progress: 0.42, timeElapsed: 1, text: '' })
    })

    expect(screen.getByRole('status')).toHaveTextContent('42%')
  })

  it('hides the loading status once the AI engine finishes loading', async () => {
    signIn()
    const enginePromise = Promise.resolve({ complete: vi.fn() })
    const loadEngine = vi.fn().mockReturnValue(enginePromise)

    renderPlanChatPage(createFakeTripsServer(), loadEngine, () => true)
    expect(screen.getByRole('status')).toBeInTheDocument()

    await act(async () => {
      await enginePromise
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('hides the loading status when the engine fails to load', async () => {
    signIn()
    const loadEngine = vi.fn().mockRejectedValue(new Error('load failed'))

    renderPlanChatPage(createFakeTripsServer(), loadEngine, () => true)
    expect(screen.getByRole('status')).toBeInTheDocument()

    await act(async () => {
      await loadEngine.mock.results[0].value.catch(() => {})
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('never shows a loading status on a browser without AI support', () => {
    signIn()
    renderPlanChatPage(createFakeTripsServer())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
