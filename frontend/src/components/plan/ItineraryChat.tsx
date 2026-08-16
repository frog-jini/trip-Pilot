// 채팅 UI만 담당하는 순수 프레젠테이션 컴포넌트. 메시지를 해석하고 실제로 일정을 바꾸는 로직은
// 전혀 모른다 — onSendMessage로 문자열을 넘기면 ChatReply(번역 함수) 답장을 받아서 대화창에
// 쌓기만 한다. 그래서 같은 컴포넌트를 TripDetailPage(일정 수정 채팅)와 PlanChatPage(대화로 일정
// 만들기)가 서로 다른 onSendMessage/문구를 주입해서 재사용한다.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { useLanguage } from '../../context/languageContextValue'
import type { ChatReply } from '../../lib/chatReply'

type ChatMessage =
  | { role: 'user'; text: string }
  // AI 답장은 완성된 문자열이 아니라 ChatReply(번역 키+파라미터를 들고 있는 함수)로 저장해서,
  // 매 렌더마다 현재 언어의 t()로 다시 조립한다 — 그래야 언어를 바꾸면 이미 화면에 찍힌 과거
  // 답장도 즉시 새 언어의 문장 틀로 다시 그려진다. 사용자가 채팅에 직접 입력한 활동명 같은 자유
  // 텍스트는 ChatReply의 params 안에 원문 그대로 남아있으니, 그 부분만은 번역되지 않는다.
  | { role: 'ai'; reply: ChatReply }

interface ItineraryChatProps {
  // 동기/비동기 둘 다 허용 — 정규식으로 즉시 답하는 경우도 있고, 로컬 LLM 호출처럼 실제로
  // 기다려야 하는 경우도 있어서 호출부가 어느 쪽이든 그대로 쓸 수 있게 했다.
  onSendMessage: (message: string) => ChatReply | Promise<ChatReply>
  title?: string
  greeting?: string
  placeholder?: string
}

export function ItineraryChat({ onSendMessage, title, greeting, placeholder }: ItineraryChatProps) {
  const { t } = useLanguage()
  // 기본값은 "날씨 챗" 문구다 — TripDetailPage가 별도로 title/greeting/placeholder를 넘기지 않던
  // 시절의 유산이지만, PlanChatPage는 항상 자기 문구로 덮어써서 쓰기 때문에 남겨둬도 무방하다.
  const resolvedTitle = title ?? t('plan.chatDefaultTitle')
  const resolvedGreeting = greeting ?? t('plan.chatDefaultGreeting')
  const resolvedPlaceholder = placeholder ?? t('plan.chatDefaultPlaceholder')
  // 인사말은 아직 아무도 "말하지 않은" 예시 문구라, 대화 이력(messages)에 넣어 마운트 시점 언어로
  // 얼려버리지 않는다 — 대신 매 렌더마다 resolvedGreeting을 그대로 화면 맨 앞에 그려서, 언어를
  // 바꾸면 즉시 새 언어로 보이게 한다. 한번 오간 실제 AI 답장(messages)도 마찬가지로 언어를
  // 바꾸면 즉시 새 언어로 다시 그려진다(ChatReply, 위 타입 참고) — 다만 사용자 메시지(user)는
  // 사용자가 그 언어로 실제로 입력한 원문이라 번역 대상이 아니므로 항상 그대로 남는다.
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const inputId = useId()
  const bottomRef = useRef<HTMLDivElement>(null)

  // 메시지가 늘어나거나 "···" 응답 대기 표시가 뜰 때마다 최신 메시지가 보이도록 아래로 스크롤한다.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, pending])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = input.trim()
    if (!trimmed) return

    // 사용자 메시지를 먼저 화면에 올리고 입력창을 비운 다음, 답장이 오는 동안은 pending으로
    // 입력을 막는다 — 로컬 LLM 호출처럼 몇 초 걸릴 수 있는 응답이 겹쳐 들어오지 않게 하기 위함.
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }])
    setInput('')
    setPending(true)

    const reply = await onSendMessage(trimmed)

    setMessages((prev) => [...prev, { role: 'ai', reply }])
    setPending(false)
  }

  return (
    <Card>
      <h3 className="text-base text-primary-700 dark:text-primary-400">{resolvedTitle}</h3>

      <div role="log" aria-label={t('plan.chatLogAriaLabel')} className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-ai-100 px-4 py-2.5 text-sm text-ai-800 dark:bg-ai-950 dark:text-ai-200">
          {resolvedGreeting}
        </p>
        {messages.map((message, index) => (
          <p
            key={index}
            className={
              message.role === 'user'
                ? 'ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-primary-600 px-4 py-2.5 text-sm text-white'
                : 'max-w-[85%] rounded-2xl rounded-tl-sm bg-ai-100 px-4 py-2.5 text-sm text-ai-800 dark:bg-ai-950 dark:text-ai-200'
            }
          >
            {message.role === 'user' ? message.text : message.reply(t)}
          </p>
        ))}
        {pending ? (
          <p
            aria-label={t('plan.chatPendingAriaLabel')}
            className="max-w-[85%] rounded-2xl rounded-tl-sm bg-ai-100 px-4 py-2.5 text-sm text-ai-800 dark:bg-ai-950 dark:text-ai-200"
          >
            ···
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t('plan.chatMessageInputLabel')}
        </label>
        <input
          id={inputId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={resolvedPlaceholder}
          disabled={pending}
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {t('plan.chatSendButton')}
        </Button>
      </form>
    </Card>
  )
}
