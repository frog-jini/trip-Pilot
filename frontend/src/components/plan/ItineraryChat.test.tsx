// ItineraryChat 자체는 메시지 해석을 전혀 하지 않는 순수 UI라, onSendMessage를 그대로
// 흉내 낸 mock으로만 검증한다 — 동기/비동기 응답, pending 상태, 입력창 동작이 대상이다.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ItineraryChat } from './ItineraryChat'
import { LanguageProvider } from '../../context/LanguageContext'
import { LanguageSwitcher } from '../layout/LanguageSwitcher'
import { reply, type ChatReply } from '../../lib/chatReply'

describe('ItineraryChat', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('renders an initial AI greeting', () => {
    render(<ItineraryChat onSendMessage={vi.fn()} />)
    expect(screen.getByRole('log', { name: 'AI 채팅' })).toBeInTheDocument()
    expect(screen.getAllByText(/날씨/).length).toBeGreaterThan(0)
  })

  it('sends the trimmed message, shows it, and displays the AI reply', async () => {
    const user = userEvent.setup()
    const onSendMessage = vi.fn().mockReturnValue(() => '실외 관광 대신 쇼핑몰과 실내 관광 위주로 변경했어요.')
    render(<ItineraryChat onSendMessage={onSendMessage} />)

    await user.type(screen.getByLabelText('메시지 입력'), '  둘째 날은 비가 올 것 같아  ')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(onSendMessage).toHaveBeenCalledWith('둘째 날은 비가 올 것 같아')
    expect(screen.getByText('둘째 날은 비가 올 것 같아')).toBeInTheDocument()
    expect(screen.getByText('실외 관광 대신 쇼핑몰과 실내 관광 위주로 변경했어요.')).toBeInTheDocument()
  })

  it('clears the input after sending', async () => {
    const user = userEvent.setup()
    render(<ItineraryChat onSendMessage={vi.fn().mockReturnValue(() => '알겠어요.')} />)

    const input = screen.getByLabelText('메시지 입력')
    await user.type(input, '안녕')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(input).toHaveValue('')
  })

  it('scrolls the chat log to the latest message after sending', async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    render(<ItineraryChat onSendMessage={vi.fn().mockReturnValue(() => '답장')} />)

    await user.type(screen.getByLabelText('메시지 입력'), '안녕')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(scrollIntoView).toHaveBeenCalled()
    scrollIntoView.mockRestore()
  })

  it('does not send an empty or whitespace-only message', async () => {
    const user = userEvent.setup()
    const onSendMessage = vi.fn()
    render(<ItineraryChat onSendMessage={onSendMessage} />)

    await user.type(screen.getByLabelText('메시지 입력'), '   ')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(onSendMessage).not.toHaveBeenCalled()
  })

  // onSendMessage가 즉시 문자열을 줄 수도, Promise를 줄 수도 있어서(TripDetailPage는 async,
  // 다른 곳은 동기) resolve를 나중에 직접 호출해 "응답 대기 중" 상태를 실제로 붙잡아본다.
  it('shows a pending indicator while awaiting an async reply, then replaces it with the reply', async () => {
    const user = userEvent.setup()
    let resolveReply: (value: ChatReply) => void = () => {}
    const onSendMessage = vi.fn().mockReturnValue(
      new Promise<ChatReply>((resolve) => {
        resolveReply = resolve
      }),
    )
    render(<ItineraryChat onSendMessage={onSendMessage} />)

    await user.type(screen.getByLabelText('메시지 입력'), '도쿄로 가고 싶어')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(screen.getByLabelText('AI 응답 대기 중')).toBeInTheDocument()

    resolveReply(() => '어디로 여행 가고 싶으세요?')

    await waitFor(() => expect(screen.getByText('어디로 여행 가고 싶으세요?')).toBeInTheDocument())
    expect(screen.queryByLabelText('AI 응답 대기 중')).not.toBeInTheDocument()
  })

  it('disables the send button while a reply is pending', async () => {
    const user = userEvent.setup()
    let resolveReply: (value: ChatReply) => void = () => {}
    const onSendMessage = vi.fn().mockReturnValue(
      new Promise<ChatReply>((resolve) => {
        resolveReply = resolve
      }),
    )
    render(<ItineraryChat onSendMessage={onSendMessage} />)

    await user.type(screen.getByLabelText('메시지 입력'), '안녕')
    await user.click(screen.getByRole('button', { name: '보내기' }))

    expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled()

    resolveReply(() => '네')

    await waitFor(() => expect(screen.getByRole('button', { name: '보내기' })).not.toBeDisabled())
  })

  it('renders a custom title and greeting when provided', () => {
    render(
      <ItineraryChat
        onSendMessage={vi.fn()}
        title="AI에게 여행 이야기를 들려주세요"
        greeting="어디로 여행 가고 싶으세요?"
      />,
    )

    expect(screen.getByRole('heading', { name: 'AI에게 여행 이야기를 들려주세요' })).toBeInTheDocument()
    expect(screen.getByText('어디로 여행 가고 싶으세요?')).toBeInTheDocument()
  })

  it('defaults the input placeholder to a weather example', () => {
    render(<ItineraryChat onSendMessage={vi.fn()} />)
    expect(screen.getByLabelText('메시지 입력')).toHaveAttribute('placeholder', '예: 둘째 날은 비가 올 것 같아')
  })

  it('renders a custom placeholder when provided', () => {
    render(
      <ItineraryChat
        onSendMessage={vi.fn()}
        placeholder="예: 도쿄 2박3일로 쇼핑 위주 일정 짜줘, 예산은 100만원"
      />,
    )
    expect(screen.getByLabelText('메시지 입력')).toHaveAttribute(
      'placeholder',
      '예: 도쿄 2박3일로 쇼핑 위주 일정 짜줘, 예산은 100만원',
    )
  })

  it('updates the still-untouched default greeting when the language changes without remounting', async () => {
    // 아직 아무 메시지도 안 보낸 상태(예시 인사말만 떠 있는 상태)에서 언어를 바꾸면, 그 인사말도
    // 즉시 새 언어로 바뀌어야 한다 — "대화 중인 실제 메시지"가 아니라 아직은 그냥 예시이기 때문.
    const user = userEvent.setup()
    render(
      <LanguageProvider>
        <LanguageSwitcher />
        <ItineraryChat onSendMessage={vi.fn()} />
      </LanguageProvider>,
    )

    expect(screen.getAllByText(/날씨/).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.queryByText(/날씨가 바뀌면/)).not.toBeInTheDocument()
    expect(screen.getByText(/Let me know if the weather changes/)).toBeInTheDocument()
  })

  it('keeps an already-sent user message exactly as typed, even after switching languages', async () => {
    // 사용자 메시지는 그 언어로 실제로 입력한 원문이라 번역 대상이 아니다 — 언어를 바꿔도
    // 그대로 남아야 한다. (AI 답장 쪽은 아래 테스트에서 다룬다.)
    const user = userEvent.setup()
    const onSendMessage = vi.fn().mockReturnValue(reply('tripDetail.clarificationMessage'))
    render(
      <LanguageProvider>
        <LanguageSwitcher />
        <ItineraryChat onSendMessage={onSendMessage} />
      </LanguageProvider>,
    )

    await user.type(screen.getByLabelText('메시지 입력'), '안녕')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    await screen.findByText('안녕')

    await user.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByText('안녕')).toBeInTheDocument()
  })

  it('re-renders an already-sent AI reply in the newly selected language, keeping raw user-provided text untranslated inside it', async () => {
    // Regression: previously AI replies were stored as plain, already-translated strings, so an
    // already-sent reply stayed frozen in whatever language was active when it was first shown —
    // even brand new replies after switching kept showing the old language for messages sent
    // through the local-AI path. Storing a ChatReply (translation key + params) instead means the
    // sentence template is rebuilt in the new language on every render, while free text the user
    // actually typed (like an activity name) is carried through unchanged inside the params.
    const user = userEvent.setup()
    const onSendMessage = vi.fn().mockReturnValue(reply('tripDetail.noticeActivityAdded', { day: 2, activity: '디즈니랜드' }))
    render(
      <LanguageProvider>
        <LanguageSwitcher />
        <ItineraryChat onSendMessage={onSendMessage} />
      </LanguageProvider>,
    )

    await user.type(screen.getByLabelText('메시지 입력'), '2일차에 디즈니랜드로 가줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    expect(await screen.findByText(/2일차에.*디즈니랜드.*추가했어요/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByText(/Added "디즈니랜드" to day 2/)).toBeInTheDocument()
    expect(screen.queryByText(/추가했어요/)).not.toBeInTheDocument()
  })
})
